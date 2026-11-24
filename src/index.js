/**
 * Carbon Trigger popup: entry point.
 *
 * Webpack starts here and bundles every file this one requires into
 * dist/main.js. All the real work lives in the other modules:
 *
 * - config.js     constants
 * - validation.js pure input and data checks
 * - storage.js    localStorage (credentials, cache, history)
 * - api.js        India Energy Maps request with retries
 * - icon.js       toolbar icon color
 * - ui.js         everything that touches the page
 * - app.js        the app flow that ties it all together
 *
 * Only the pure helper functions are re-exported, for use in unit tests.
 *
 * @module index
 */

const { bootstrap } = require('./app');
const { isValidApiKey, isValidRegionCode, isValidCacheEntry } = require('./validation');
const { isCacheFresh } = require('./storage');
const { isRetryableError, getRetryDelay } = require('./api');
const { formatAge } = require('./ui');
const { getColorForIntensity } = require('./icon');

bootstrap();

module.exports = {
	isValidApiKey,
	isValidRegionCode,
	isValidCacheEntry,
	isCacheFresh,
	isRetryableError,
	getRetryDelay,
	formatAge,
	getColorForIntensity,
};
