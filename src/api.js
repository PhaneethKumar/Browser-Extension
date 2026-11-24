/**
 * Network layer: calls the India Energy Maps API and retries transient failures with
 * exponential backoff. This file knows nothing about the page; progress and
 * cancellation are reported through callbacks passed in by the caller.
 *
 * @module api
 */

const axios = require('axios');
const {
	API_URL,
	REQUEST_TIMEOUT_MS,
	TOTAL_ATTEMPTS,
	BASE_RETRY_DELAY_MS,
	MAX_RETRY_DELAY_MS,
	MAX_JITTER_MS,
} = require('./config');
const { isValidCarbonData } = require('./validation');

/**
 * Error thrown when a request was superseded (e.g. the user reset the form).
 */
class CancelledError extends Error {
	constructor() {
		super('Request cancelled');
		this.name = 'CancelledError';
	}
}

function firstFiniteValue(objects, keys) {
	for (const object of objects) {
		if (!object || typeof object !== 'object') continue;
		for (const key of keys) {
			if (Object.prototype.hasOwnProperty.call(object, key)) {
				const value = Number(object[key]);
				if (Number.isFinite(value)) return value;
			}
		}
	}
	return null;
}

function extractCarbonData(responseData) {
	const payload = responseData && (responseData.data || responseData);
	const data = Array.isArray(payload) ? payload[0] : payload && Array.isArray(payload.items) ? payload.items[0] : payload;
	if (!data || typeof data !== 'object') return null;

	const nestedObjects = [
		data,
		data.carbonIntensity,
		data.carbon_intensity,
		data.average,
		data.mix,
		data.fuel_mix,
		data.fuelMix,
	];
	const carbonIntensity = firstFiniteValue(nestedObjects, [
		'carbonIntensity',
		'carbon_intensity',
		'carbon_intensity_gco2_per_kwh',
		'carbon_intensity_gco2_kwh',
		'gco2_per_kwh',
		'gco2_kwh',
		'ci_gco2_per_kwh',
		'value',
		'kg_co2e_per_mwh',
	]);
	if (carbonIntensity === null) return null;

	let fossilFuelPercentage = firstFiniteValue(nestedObjects, [
		'fossilFuelPercentage',
		'fossil_fuel_percentage',
		'fossil_share_percentage',
		'fossil_fuel_pct',
		'fossil_pct',
		'fossil_share_pct',
		'fossil_share',
		'fossil_fuel_share',
	]);

	if (fossilFuelPercentage === null) {
		const fuelMix = data.fuel_mix || data.fuelMix || data.mix || data;
		const thermal = firstFiniteValue([fuelMix], ['thermal', 'thermal_pct', 'coal_pct', 'coal']);
		const gas = firstFiniteValue([fuelMix], ['gas', 'gas_pct']);
		if (Number.isFinite(thermal) || Number.isFinite(gas)) {
			fossilFuelPercentage = (thermal || 0) + (gas || 0);
		}
	}

	return { carbonIntensity, fossilFuelPercentage };
}

/**
 * Decides whether a failed request is worth retrying.
 * Network failures, timeouts, 408, 429 and 5xx are transient; other 4xx
 * responses (bad key, unknown region) will fail again, so they are not retried.
 * @param {Error & {response?: {status: number}, retryable?: boolean}} error - The error from the failed attempt.
 * @returns {boolean} True if another attempt is reasonable.
 */
function isRetryableError(error) {
	if (error.retryable === false) {
		return false;
	}
	const status = error.response && error.response.status;
	if (!status) {
		return true; // no response: network error or timeout
	}
	return status === 408 || status === 429 || status >= 500;
}

/**
 * Calculates the wait before the next retry: base * 2^retryIndex plus jitter,
 * capped at {@link MAX_RETRY_DELAY_MS}. Honours a numeric Retry-After header.
 * @param {number} retryIndex - Zero-based retry number (0 for the first retry).
 * @param {{response?: {headers?: Object<string, string>}}} [error] - The failed attempt's error.
 * @param {() => number} [random=Math.random] - Random source (injectable for tests).
 * @returns {number} Delay in milliseconds.
 */
function getRetryDelay(retryIndex, error, random = Math.random) {
	const retryAfterSeconds = Number(error && error.response && error.response.headers && error.response.headers['retry-after']);
	if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
		return Math.min(retryAfterSeconds * 1000, MAX_RETRY_DELAY_MS);
	}
	const exponential = BASE_RETRY_DELAY_MS * 2 ** retryIndex;
	return Math.min(exponential + random() * MAX_JITTER_MS, MAX_RETRY_DELAY_MS);
}

/**
 * Waits for a duration while updating a countdown, stopping early if the request is superseded.
 * @param {number} ms - How long to wait.
 * @param {(secondsLeft: number) => void} onTick - Called immediately and then every second.
 * @param {() => boolean} isCancelled - Returns true once the waiting request has been superseded.
 * @returns {Promise<void>} Resolves when the wait is over.
 * @throws {CancelledError} If the request was superseded while waiting.
 */
function waitWithCountdown(ms, onTick, isCancelled) {
	return new Promise((resolve, reject) => {
		const endsAt = Date.now() + ms;

		const tick = () => {
			if (isCancelled()) {
				reject(new CancelledError());
				return;
			}
			const remaining = endsAt - Date.now();
			if (remaining <= 0) {
				resolve();
				return;
			}
			onTick(Math.ceil(remaining / 1000));
			setTimeout(tick, Math.min(1000, remaining));
		};

		tick();
	});
}

/**
 * Calls the India Energy Maps API once.
 * @param {string} apiKey - The India Energy Maps API key.
 * @param {string} region - Energy Maps zone.
 * @returns {Promise<CarbonData>} The parsed carbon data.
 * @throws {Error} On HTTP/network errors, or if the response body is malformed (marked non-retryable).
 */
async function requestCarbonData(apiKey, region) {
	const response = await axios.get(API_URL, {
		params: { zone: region, hours: 0, factors: 'lifecycle' },
		headers: { 'X-API-Key': apiKey },
		timeout: REQUEST_TIMEOUT_MS,
	});

	const data = extractCarbonData(response.data);
	if (!isValidCarbonData(data)) {
		const error = new Error('Unexpected API response shape');
		error.retryable = false;
		throw error;
	}
	return data;
}

/**
 * Fetches carbon data, retrying transient failures with exponential backoff
 * and reporting progress through the supplied callbacks.
 * @param {string} apiKey - The India Energy Maps API key.
 * @param {string} region - Region code.
 * @param {FetchHooks} [hooks] - Optional progress and cancellation callbacks.
 * @returns {Promise<CarbonData>} The carbon data from the first successful attempt.
 * @throws {CancelledError} If the request was superseded.
 * @throws {Error} The last error once retries are exhausted or a non-retryable error occurs.
 */
async function fetchWithRetry(apiKey, region, { onProgress = () => {}, isCancelled = () => false } = {}) {
	let lastError;

	for (let attempt = 1; attempt <= TOTAL_ATTEMPTS; attempt += 1) {
		onProgress(`Fetching data (attempt ${attempt} of ${TOTAL_ATTEMPTS})...`, attempt);

		try {
			const data = await requestCarbonData(apiKey, region);
			if (isCancelled()) {
				throw new CancelledError();
			}
			return data;
		} catch (error) {
			if (error instanceof CancelledError || isCancelled()) {
				throw new CancelledError();
			}
			lastError = error;

			const isLastAttempt = attempt === TOTAL_ATTEMPTS;
			if (isLastAttempt || !isRetryableError(error)) {
				break;
			}

			const delay = getRetryDelay(attempt - 1, error);
			await waitWithCountdown(
				delay,
				(secondsLeft) =>
					onProgress(`Attempt ${attempt} of ${TOTAL_ATTEMPTS} failed. Retrying in ${secondsLeft}s...`, attempt),
				isCancelled
			);
		}
	}

	throw lastError;
}

module.exports = {
	CancelledError,
	isRetryableError,
	getRetryDelay,
	fetchWithRetry,
	extractCarbonData,
};
