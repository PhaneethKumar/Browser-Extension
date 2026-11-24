/**
 * Pure validation helpers. None of these touch the page or localStorage,
 * so they are easy to test on their own.
 *
 * @module validation
 */

const { API_KEY_MIN_LENGTH, VALID_ZONES } = require('./config');

/**
 * Checks that an API key is long enough to plausibly be valid.
 * @param {string} apiKey - The raw API key input.
 * @returns {boolean} True if the trimmed key meets the minimum length.
 */
function isValidApiKey(apiKey) {
	return apiKey.trim().length >= API_KEY_MIN_LENGTH;
}

/**
 * Checks a zone against the zones supported by Energy Maps.
 * @param {string} regionCode - The raw zone input.
 * @returns {boolean} True if the trimmed zone is supported.
 */
function isValidRegionCode(regionCode) {
	return typeof regionCode === 'string' && VALID_ZONES.includes(regionCode.trim().toLowerCase());
}

/**
 * Checks that a value has the shape of a {@link CarbonData} object.
 * @param {*} data - Value to check.
 * @returns {boolean} True if both numeric fields are finite numbers.
 */
function isValidCarbonData(data) {
	return (
		Boolean(data) &&
		Number.isFinite(data.carbonIntensity) &&
		(data.fossilFuelPercentage === null ||
			data.fossilFuelPercentage === undefined ||
			Number.isFinite(data.fossilFuelPercentage))
	);
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

module.exports = {
	isValidApiKey,
	isValidRegionCode,
	isValidCarbonData,
	isValidCacheEntry,
};
