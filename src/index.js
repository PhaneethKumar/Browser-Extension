const axios = require('axios');

/*---------- JSDoc Comments ----------*/

/* ---------- Types ---------- */
/**
 * Carbon data returned by the CO2 Signal API.
 * @typedef {Object} CarbonData
 * @property {number} carbonIntensity - Grams of CO2 emitted per kilowatt hour.
 * @property {number} fossilFuelPercentage - Share of electricity generated from fossil fuels (0-100).
 */

/**
 * A cached API response.
 * @typedef {Object} CacheEntry
 * @property {number} timestamp - Epoch ms when the data was fetched.
 * @property {number} expiresAt - Epoch ms after which the entry is considered stale.
 * @property {CarbonData} data - The cached payload.
 */

/**
 * One previously fetched reading, shown in the history list.
 * @typedef {Object} HistoryEntry
 * @property {string} region - Region code the reading belongs to.
 * @property {number} timestamp - Epoch ms when the reading was fetched.
 * @property {number} carbonIntensity - Grams of CO2 per kWh.
 * @property {number} fossilFuelPercentage - Fossil fuel share (0-100).
 */

/**
 * Options for {@link displayCarbonUsage}.
 * @typedef {Object} DisplayOptions
 * @property {boolean} [forceRefresh=false] - Skip a fresh cache entry and call the API anyway.
 */

/**
 * Describes where displayed data came from.
 * @typedef {Object} RenderSource
 * @property {'network'|'cache'|'stale-cache'} kind
 * @property {number} timestamp - Epoch ms when the displayed data was fetched.
 */

/* ---------- Constants ---------- */
const STORAGE_KEYS = {
	apiKey: 'apiKey',
	region: 'regionName',
	history: 'carbonHistory',
	cachePrefix: 'carbonCache:',
};
const API_KEY_MIN_LENGTH = 20;
const REGION_CODE_PATTERN = /^[A-Z]{2}(?:-[A-Z0-9]+)*$/;

const API_URL = 'https://api.co2signal.com/v1/latest';
const REQUEST_TIMEOUT_MS = 10000;

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

const MAX_RETRIES = 3; // 1 initial attempt + 3 retries = 4 attempts
const TOTAL_ATTEMPTS = MAX_RETRIES + 1;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 15000;
const MAX_JITTER_MS = 250;

const MAX_HISTORY_ENTRIES = 20;
const HISTORY_DISPLAY_COUNT = 10;

/* ---------- DOM references (queried once) ---------- */

const dom = {};

/**
 * Queries and stores the required DOM elements.
 * @returns {boolean} True when every required element exists.
 */
function cacheDom() {
	dom.form = document.querySelector('.form-data');
	dom.apiInput = document.querySelector('#api');
	dom.apiFeedback = document.querySelector('#api-feedback');
	dom.regionInput = document.querySelector('#region');
	dom.regionFeedback = document.querySelector('#region-feedback');
	dom.toggleApiKeyButton = document.querySelector('.toggle-api-key');
	dom.result = document.querySelector('.result');
	dom.loading = document.querySelector('.loading');
	dom.errors = document.querySelector('.errors');
	dom.resultContainer = document.querySelector('.result-container');
	dom.clearBtn = document.querySelector('.clear-btn');
	dom.myRegion = document.querySelector('.my-region');
	dom.carbonUsage = document.querySelector('.carbon-usage');
	dom.fossilFuel = document.querySelector('.fossil-fuel');

	return Object.values(dom).every(Boolean);
}

/**
 * Creates the elements added by the enhanced flow (progress bar, data-source
 * note and history list) so index.html does not need to change.
 * Call after {@link cacheDom} succeeds.
 * @returns {void}
 */
function createEnhancedUi() {
	// Loading state: message + progress bar inside the existing .loading element
	dom.loading.textContent = '';
	dom.loading.setAttribute('role', 'status');
	dom.loading.setAttribute('aria-live', 'polite');

	dom.loadingMessage = document.createElement('div');
	dom.loadingMessage.className = 'loading-message';
	dom.loadingMessage.textContent = 'loading...';

	dom.loadingProgress = document.createElement('progress');
	dom.loadingProgress.className = 'loading-progress';
	dom.loadingProgress.max = TOTAL_ATTEMPTS;
	dom.loadingProgress.value = 0;

	dom.loading.append(dom.loadingMessage, dom.loadingProgress);

	// Note describing whether the data is live or cached
	dom.dataSource = document.createElement('p');
	dom.dataSource.className = 'data-source';
	dom.resultContainer.appendChild(dom.dataSource);

	// History section, placed above the "Change region" button
	dom.historyContainer = document.createElement('div');
	dom.historyContainer.className = 'history';
	dom.historyContainer.hidden = true;

	const heading = document.createElement('h2');
	heading.textContent = 'Previous readings';

	dom.historyList = document.createElement('ul');
	dom.historyList.className = 'history-list';

	dom.historyContainer.append(heading, dom.historyList);
	dom.result.insertBefore(dom.historyContainer, dom.clearBtn);
}

/* ---------- Validation ---------- */

/**
 * Checks that an API key is long enough to plausibly be valid.
 * @param {string} apiKey - The raw API key input.
 * @returns {boolean} True if the trimmed key meets the minimum length.
 */
function isValidApiKey(apiKey) {
	return apiKey.trim().length >= API_KEY_MIN_LENGTH;
}

/**
 * Checks a region code against the Electricity Maps zone format (e.g. US-NEISO).
 * @param {string} regionCode - The raw region input.
 * @returns {boolean} True if the trimmed code matches the expected pattern.
 */
function isValidRegionCode(regionCode) {
	return REGION_CODE_PATTERN.test(regionCode.trim());
}

/**
 * Applies valid/invalid styling and a feedback message to a field.
 * @param {HTMLInputElement} input - The input element.
 * @param {HTMLElement} feedback - The element that shows the message.
 * @param {boolean} isValid - Whether the field value is valid.
 * @param {string} message - Text shown to the user.
 * @returns {void}
 */
function setValidationState(input, feedback, isValid, message) {
	input.classList.toggle('is-valid', isValid);
	input.classList.toggle('is-invalid', !isValid);
	feedback.classList.toggle('is-valid', isValid);
	feedback.classList.toggle('is-invalid', !isValid);
	input.setAttribute('aria-invalid', String(!isValid));
	feedback.textContent = message;
}

/**
 * Removes validation styling and messages from a field.
 * @param {HTMLInputElement} input - The input element.
 * @param {HTMLElement} feedback - The feedback element.
 * @returns {void}
 */
function clearValidationState(input, feedback) {
	input.classList.remove('is-valid', 'is-invalid');
	feedback.classList.remove('is-valid', 'is-invalid');
	input.removeAttribute('aria-invalid');
	feedback.textContent = '';
}

/**
 * Validates the API key field and updates its feedback.
 * @returns {boolean} True if the field is valid.
 */
function validateApiKeyField() {
	const isValid = isValidApiKey(dom.apiInput.value);
	const message = isValid ? 'API key looks valid.' : `API key must be at least ${API_KEY_MIN_LENGTH} characters.`;
	setValidationState(dom.apiInput, dom.apiFeedback, isValid, message);
	return isValid;
}

/**
 * Validates the region field and updates its feedback.
 * @returns {boolean} True if the field is valid.
 */
function validateRegionField() {
	const isValid = isValidRegionCode(dom.regionInput.value);
	const message = isValid ? 'Region code looks valid.' : 'Use a format such as US-NEISO.';
	setValidationState(dom.regionInput, dom.regionFeedback, isValid, message);
	return isValid;
}

/* ---------- Storage: credentials ---------- */

/**
 * Reads the saved credentials from localStorage.
 * @returns {{apiKey: (string|null), region: (string|null)}} Stored values, or null for missing ones.
 */
function getStoredCredentials() {
	return {
		apiKey: localStorage.getItem(STORAGE_KEYS.apiKey),
		region: localStorage.getItem(STORAGE_KEYS.region),
	};
}

/**
 * Saves credentials to localStorage.
 * @param {string} apiKey - The API key to store.
 * @param {string} region - The region code to store.
 * @returns {void}
 */
function saveCredentials(apiKey, region) {
	localStorage.setItem(STORAGE_KEYS.apiKey, apiKey);
	localStorage.setItem(STORAGE_KEYS.region, region);
}

/**
 * Removes saved credentials from localStorage. Cached responses and history are kept.
 * @returns {void}
 */
function clearCredentials() {
	localStorage.removeItem(STORAGE_KEYS.apiKey);
	localStorage.removeItem(STORAGE_KEYS.region);
}

/* ---------- Storage: cache ---------- */

/**
 * Reads and parses JSON from localStorage, tolerating missing or corrupt values.
 * @param {string} key - The localStorage key.
 * @returns {*} The parsed value, or null if absent or unparseable.
 */
function readJson(key) {
	try {
		const raw = localStorage.getItem(key);
		return raw ? JSON.parse(raw) : null;
	} catch (error) {
		console.warn(`Ignoring unreadable localStorage entry "${key}"`, error);
		return null;
	}
}

/**
 * Writes JSON to localStorage. Failures (e.g. quota exceeded) are logged, not thrown,
 * because caching is an optimisation and must never break the UI.
 * @param {string} key - The localStorage key.
 * @param {*} value - A JSON-serialisable value.
 * @returns {boolean} True if the write succeeded.
 */
function writeJson(key, value) {
	try {
		localStorage.setItem(key, JSON.stringify(value));
		return true;
	} catch (error) {
		console.warn(`Could not write localStorage entry "${key}"`, error);
		return false;
	}
}

/**
 * Checks that a value has the shape of a {@link CarbonData} object.
 * @param {*} data - Value to check.
 * @returns {boolean} True if both numeric fields are finite numbers.
 */
function isValidCarbonData(data) {
	return Boolean(data) && Number.isFinite(data.carbonIntensity) && Number.isFinite(data.fossilFuelPercentage);
}

/**
 * Checks that a value has the shape of a {@link CacheEntry}.
 * @param {*} entry - Value to check.
 * @returns {boolean} True if the entry is structurally valid.
 */
function isValidCacheEntry(entry) {
	return (
		Boolean(entry) &&
		Number.isFinite(entry.timestamp) &&
		Number.isFinite(entry.expiresAt) &&
		isValidCarbonData(entry.data)
	);
}

/**
 * Builds the localStorage key for a region's cache entry.
 * @param {string} region - Region code.
 * @returns {string} The cache key.
 */
function getCacheKey(region) {
	return `${STORAGE_KEYS.cachePrefix}${region.trim().toUpperCase()}`;
}

/**
 * Reads a region's cache entry, whether or not it has expired.
 * @param {string} region - Region code.
 * @returns {CacheEntry|null} The entry, or null if missing or malformed.
 */
function readCacheEntry(region) {
	const entry = readJson(getCacheKey(region));
	return isValidCacheEntry(entry) ? entry : null;
}

/**
 * Checks whether a cache entry is still within its 30-minute lifetime.
 * @param {CacheEntry} entry - The cache entry.
 * @param {number} [now=Date.now()] - Current epoch ms (injectable for tests).
 * @returns {boolean} True if the entry has not expired.
 */
function isCacheFresh(entry, now = Date.now()) {
	return entry.expiresAt > now;
}

/**
 * Stores an API response in the cache with an expiration timestamp.
 * @param {string} region - Region code.
 * @param {CarbonData} data - Data to cache.
 * @param {number} [now=Date.now()] - Fetch time in epoch ms.
 * @returns {CacheEntry} The entry that was (attempted to be) stored.
 */
function writeCacheEntry(region, data, now = Date.now()) {
	/** @type {CacheEntry} */
	const entry = { timestamp: now, expiresAt: now + CACHE_TTL_MS, data };
	writeJson(getCacheKey(region), entry);
	return entry;
}

/* ---------- Storage: history ---------- */

/**
 * Loads the saved reading history, newest first.
 * @returns {HistoryEntry[]} Valid history entries (malformed ones are dropped).
 */
function getHistory() {
	const stored = readJson(STORAGE_KEYS.history);
	if (!Array.isArray(stored)) {
		return [];
	}
	return stored.filter(
		(item) =>
			item &&
			typeof item.region === 'string' &&
			Number.isFinite(item.timestamp) &&
			isValidCarbonData(item)
	);
}

/**
 * Prepends a reading to the history, trimming it to {@link MAX_HISTORY_ENTRIES}.
 * Only live API results should be recorded, not cache hits.
 * @param {string} region - Region code.
 * @param {CarbonData} data - The reading to record.
 * @param {number} timestamp - Epoch ms when the reading was fetched.
 * @returns {HistoryEntry[]} The updated history.
 */
function addHistoryEntry(region, data, timestamp) {
	/** @type {HistoryEntry} */
	const entry = {
		region,
		timestamp,
		carbonIntensity: data.carbonIntensity,
		fossilFuelPercentage: data.fossilFuelPercentage,
	};
	const updated = [entry, ...getHistory()].slice(0, MAX_HISTORY_ENTRIES);
	writeJson(STORAGE_KEYS.history, updated);
	return updated;
}

/**
 * Renders the most recent history entries into the history list.
 * @returns {void}
 */
function renderHistory() {
	const entries = getHistory().slice(0, HISTORY_DISPLAY_COUNT);
	dom.historyList.textContent = '';

	entries.forEach((entry) => {
		const item = document.createElement('li');
		const when = new Date(entry.timestamp).toLocaleString();
		item.textContent =
			`${when} - ${entry.region}: ${Math.round(entry.carbonIntensity)} g/kWh, ` +
			`${entry.fossilFuelPercentage.toFixed(1)}% fossil fuels`;
		dom.historyList.appendChild(item);
	});
}

/* ---------- UI state ---------- */

let activeRequestId = 0; // lets us ignore results from superseded/cancelled requests

/**
 * Invalidates any in-flight request so its result is never rendered.
 * @returns {void}
 */
function cancelActiveRequest() {
	activeRequestId += 1;
}

/**
 * Single place that decides what the user sees.
 * @param {'setup'|'loading'|'error'|'result'} view - The view to show.
 * @returns {void}
 */
function showView(view) {
	const isSetup = view === 'setup';

	dom.form.hidden = !isSetup;
	dom.result.hidden = isSetup;
	dom.clearBtn.hidden = isSetup; // reset option only for returning users

	dom.loading.hidden = view !== 'loading';
	dom.errors.hidden = view !== 'error';
	dom.resultContainer.hidden = view !== 'result';

	// History is useful on results and errors, but not during setup or loading
	const showHistory = (view === 'result' || view === 'error') && dom.historyList.children.length > 0;
	dom.historyContainer.hidden = !showHistory;
}

/**
 * Updates the loading message and progress bar.
 * @param {string} message - Text shown beside the progress bar.
 * @param {number} attempt - Number of attempts started so far (0 to {@link TOTAL_ATTEMPTS}).
 * @returns {void}
 */
function setLoadingProgress(message, attempt) {
	dom.loadingMessage.textContent = message;
	dom.loadingProgress.max = TOTAL_ATTEMPTS;
	dom.loadingProgress.value = attempt;
}

/* ---------- Retry with exponential backoff ---------- */

/**
 * Error thrown when a request was superseded (e.g. the user reset the form).
 */
class CancelledError extends Error {
	constructor() {
		super('Request cancelled');
		this.name = 'CancelledError';
	}
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
 * @param {number} requestId - The id of the request that is waiting.
 * @returns {Promise<void>} Resolves when the wait is over.
 * @throws {CancelledError} If the request was superseded while waiting.
 */
function waitWithCountdown(ms, onTick, requestId) {
	return new Promise((resolve, reject) => {
		const endsAt = Date.now() + ms;

		const tick = () => {
			if (requestId !== activeRequestId) {
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
 * Calls the CO2 Signal API once.
 * @param {string} apiKey - The CO2 Signal auth token.
 * @param {string} region - Region code (sent as countryCode).
 * @returns {Promise<CarbonData>} The parsed carbon data.
 * @throws {Error} On HTTP/network errors, or if the response body is malformed (marked non-retryable).
 */
async function requestCarbonData(apiKey, region) {
	// Adjust the endpoint/params to match the CO2 Signal API version you use.
	const response = await axios.get(API_URL, {
		params: { countryCode: region },
		headers: { 'auth-token': apiKey },
		timeout: REQUEST_TIMEOUT_MS,
	});

	const data = response.data && response.data.data;
	if (!isValidCarbonData(data)) {
		const error = new Error('Unexpected API response shape');
		error.retryable = false;
		throw error;
	}
	return { carbonIntensity: data.carbonIntensity, fossilFuelPercentage: data.fossilFuelPercentage };
}

/**
 * Fetches carbon data, retrying transient failures with exponential backoff
 * and reporting progress to the loading indicator.
 * @param {string} apiKey - The CO2 Signal auth token.
 * @param {string} region - Region code.
 * @param {number} requestId - Id used to detect cancellation.
 * @returns {Promise<CarbonData>} The carbon data from the first successful attempt.
 * @throws {CancelledError} If the request was superseded.
 * @throws {Error} The last error once retries are exhausted or a non-retryable error occurs.
 */
async function fetchWithRetry(apiKey, region, requestId) {
	let lastError;

	for (let attempt = 1; attempt <= TOTAL_ATTEMPTS; attempt += 1) {
		setLoadingProgress(`Fetching data (attempt ${attempt} of ${TOTAL_ATTEMPTS})...`, attempt);

		try {
			const data = await requestCarbonData(apiKey, region);
			if (requestId !== activeRequestId) {
				throw new CancelledError();
			}
			return data;
		} catch (error) {
			if (error instanceof CancelledError || requestId !== activeRequestId) {
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
					setLoadingProgress(
						`Attempt ${attempt} of ${TOTAL_ATTEMPTS} failed. Retrying in ${secondsLeft}s...`,
						attempt
					),
				requestId
			);
		}
	}

	throw lastError;
}

/* ---------- Display ---------- */

/**
 * Formats an age in ms as a short human-readable string.
 * @param {number} ms - Age in milliseconds.
 * @returns {string} e.g. "just now", "5 min ago", "2 h ago".
 */
function formatAge(ms) {
	const minutes = Math.floor(ms / 60000);
	if (minutes < 1) return 'just now';
	if (minutes < 60) return `${minutes} min ago`;
	return `${Math.floor(minutes / 60)} h ago`;
}

/**
 * Writes carbon data and its source note into the result area.
 * @param {string} region - Region code.
 * @param {CarbonData} data - Data to display.
 * @param {RenderSource} source - Where the data came from.
 * @returns {void}
 */
function renderResult(region, data, source) {
	dom.myRegion.textContent = region;
	dom.carbonUsage.textContent = `${Math.round(data.carbonIntensity)} grams (grams CO2 emitted per kilowatt hour)`;
	dom.fossilFuel.textContent = `${data.fossilFuelPercentage.toFixed(2)}% (percentage of fossil fuels used to generate electricity)`;

	const age = formatAge(Date.now() - source.timestamp);
	const notes = {
		network: `Live data, fetched ${age}.`,
		cache: `Cached data, fetched ${age}. Refreshes after 30 minutes.`,
		'stale-cache': `Live data is unavailable right now. Showing older data fetched ${age}.`,
	};
	dom.dataSource.textContent = notes[source.kind];
}

/**
 * Turns a failed request into a user-friendly message.
 * @param {Error & {response?: {status: number}}} error - The final error.
 * @returns {string} Message for the error area.
 */
function getErrorMessage(error) {
	const status = error.response && error.response.status;
	if (status === 401 || status === 403) {
		return 'The API key was rejected. Please check it and try again.';
	}
	if (status === 400 || status === 404) {
		return 'Sorry, we have no data for the region you requested.';
	}
	if (status === 429) {
		return 'The API rate limit was reached. Please try again in a few minutes.';
	}
	return `Sorry, we could not reach the carbon data service after ${TOTAL_ATTEMPTS} attempts. Please try again later.`;
}

/**
 * Loads and displays carbon usage for a region.
 *
 * Flow: fresh cache hit -> show immediately. Otherwise fetch from the API with
 * retries and exponential backoff (progress shown in the loading state), cache
 * the response for 30 minutes, append it to the history, and render it. If every
 * attempt fails but an older cached reading exists, that reading is shown with a
 * notice instead of an error.
 *
 * @param {string} apiKey - The CO2 Signal auth token.
 * @param {string} region - Region code, e.g. "US-NEISO".
 * @param {DisplayOptions} [options] - Optional behaviour flags.
 * @returns {Promise<CarbonData|null>} The displayed data, or null if it failed or was cancelled.
 */
async function displayCarbonUsage(apiKey, region, options = {}) {
	const { forceRefresh = false } = options;
	activeRequestId += 1;
	const requestId = activeRequestId;

	const cached = readCacheEntry(region);

	// 1) Fresh cache: no network, no loading state
	if (!forceRefresh && cached && isCacheFresh(cached)) {
		renderResult(region, cached.data, { kind: 'cache', timestamp: cached.timestamp });
		renderHistory();
		showView('result');
		return cached.data;
	}

	// 2) Fetch with retries, showing progress
	showView('loading');
	setLoadingProgress('Contacting CO2 Signal...', 0);

	try {
		const data = await fetchWithRetry(apiKey, region, requestId);

		const entry = writeCacheEntry(region, data);
		addHistoryEntry(region, data, entry.timestamp);

		renderResult(region, data, { kind: 'network', timestamp: entry.timestamp });
		renderHistory();
		showView('result');
		return data;
	} catch (error) {
		if (error instanceof CancelledError || requestId !== activeRequestId) {
			return null; // a newer request or a reset owns the UI now
		}
		console.error(error);

		// 3) Fall back to older cached data rather than showing an error
		if (cached) {
			renderResult(region, cached.data, { kind: 'stale-cache', timestamp: cached.timestamp });
			renderHistory();
			showView('result');
			return cached.data;
		}

		dom.errors.textContent = getErrorMessage(error);
		renderHistory();
		showView('error');
		return null;
	}
}

/* ---------- App flow ---------- */

/**
 * Decides the initial view from stored credentials.
 * @returns {void}
 */
function init() {
	const { apiKey, region } = getStoredCredentials();

	if (!apiKey || !region) {
		showView('setup'); // first-time user
		return;
	}

	displayCarbonUsage(apiKey, region); // returning user
}

/**
 * Clears credentials and form state, cancels any in-flight request, and returns to setup.
 * @returns {void}
 */
function reset() {
	cancelActiveRequest();
	clearCredentials();

	dom.apiInput.value = '';
	dom.regionInput.value = '';
	clearValidationState(dom.apiInput, dom.apiFeedback);
	clearValidationState(dom.regionInput, dom.regionFeedback);

	showView('setup');
}

/**
 * Handles the setup form submission: validates, saves credentials, loads data.
 * @param {SubmitEvent} event - The submit event.
 * @returns {void}
 */
function handleSubmit(event) {
	event.preventDefault();

	const regionIsValid = validateRegionField();
	const apiKeyIsValid = validateApiKeyField();

	if (!regionIsValid) {
		dom.regionInput.focus();
		return;
	}

	if (!apiKeyIsValid) {
		dom.apiInput.focus();
		return;
	}

	const apiKey = dom.apiInput.value.trim();
	const region = dom.regionInput.value.trim();

	saveCredentials(apiKey, region);
	displayCarbonUsage(apiKey, region);
}

/**
 * Toggles the API key input between masked and visible.
 * @returns {void}
 */
function toggleApiKeyVisibility() {
	const isHidden = dom.apiInput.type === 'password';
	dom.apiInput.type = isHidden ? 'text' : 'password';
	dom.toggleApiKeyButton.textContent = isHidden ? 'Hide' : 'Show';
	dom.toggleApiKeyButton.setAttribute('aria-pressed', String(isHidden));
}

/* ---------- Bootstrap ---------- */

/**
 * Attaches all event listeners.
 * @returns {void}
 */
function setupEventListeners() {
	dom.apiInput.addEventListener('input', validateApiKeyField);
	dom.regionInput.addEventListener('input', validateRegionField);
	dom.toggleApiKeyButton.addEventListener('click', toggleApiKeyVisibility);
	dom.form.addEventListener('submit', handleSubmit);
	dom.clearBtn.addEventListener('click', reset);
}

if (typeof document !== 'undefined' && cacheDom()) {
	createEnhancedUi();
	setupEventListeners();
	init();
}

if (typeof module !== 'undefined') {
	module.exports = {
		isValidApiKey,
		isValidRegionCode,
		isValidCacheEntry,
		isCacheFresh,
		isRetryableError,
		getRetryDelay,
		formatAge,
	};
}