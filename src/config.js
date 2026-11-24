/**
 * Shared constants. Nothing in this file runs any logic; it only holds values
 * that other files import, so every setting lives in one place.
 *
 * @module config
 */

const STORAGE_KEYS = {
	apiKey: 'apiKey',
	region: 'regionName',
	history: 'carbonHistory',
	cachePrefix: 'carbonCache:',
};
const API_KEY_MIN_LENGTH = 20;
const VALID_ZONES = ['northern', 'western', 'southern', 'eastern', 'north-eastern'];

const API_URL = 'https://api.energymap.in/developer/v1/carbon-intensity/by-zone';
const REQUEST_TIMEOUT_MS = 15000;

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

const MAX_RETRIES = 3; // 1 initial attempt + 3 retries = 4 attempts
const TOTAL_ATTEMPTS = MAX_RETRIES + 1;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 15000;
const MAX_JITTER_MS = 250;

const MAX_HISTORY_ENTRIES = 20;
const HISTORY_DISPLAY_COUNT = 10;

// CO2 intensity scale (grams per kWh) and its matching toolbar-icon colors,
// from green (clean) to dark brown (high carbon)
const CO2_SCALE = [0, 150, 600, 750, 800];
const CO2_COLORS = ['#2AA364', '#F5EB4D', '#9E4229', '#381D02', '#381D02'];
const DEFAULT_ICON_COLOR = 'green';

module.exports = {
	STORAGE_KEYS,
	API_KEY_MIN_LENGTH,
	VALID_ZONES,
	API_URL,
	REQUEST_TIMEOUT_MS,
	CACHE_TTL_MS,
	MAX_RETRIES,
	TOTAL_ATTEMPTS,
	BASE_RETRY_DELAY_MS,
	MAX_RETRY_DELAY_MS,
	MAX_JITTER_MS,
	MAX_HISTORY_ENTRIES,
	HISTORY_DISPLAY_COUNT,
	CO2_SCALE,
	CO2_COLORS,
	DEFAULT_ICON_COLOR,
};
