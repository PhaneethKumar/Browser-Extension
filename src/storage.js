/**
 * Everything saved in localStorage: credentials, cached API responses and
 * the reading history. No other file reads or writes localStorage directly.
 *
 * @module storage
 */

const { STORAGE_KEYS, CACHE_TTL_MS, MAX_HISTORY_ENTRIES } = require('./config');
const { isValidCarbonData, isValidCacheEntry } = require('./validation');

/* ---------- Credentials ---------- */

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

/* ---------- JSON helpers (private to this file) ---------- */

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

/* ---------- Cache ---------- */

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

/* ---------- History ---------- */

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

module.exports = {
	getStoredCredentials,
	saveCredentials,
	clearCredentials,
	readCacheEntry,
	isCacheFresh,
	writeCacheEntry,
	getHistory,
	addHistoryEntry,
};
