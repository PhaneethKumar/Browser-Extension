/**
 * App flow: decides what happens when the popup opens, when the form is
 * submitted and when the user resets. It wires the other modules together
 * but contains no low-level details (storage, network and page code live elsewhere).
 *
 * @module app
 */

const { CancelledError, fetchWithRetry } = require('./api');
const {
	getStoredCredentials,
	saveCredentials,
	clearCredentials,
	readCacheEntry,
	isCacheFresh,
	writeCacheEntry,
	getHistory,
	addHistoryEntry,
} = require('./storage');
const { setDefaultIconColor } = require('./icon');
const { VALID_ZONES } = require('./config');
const {
	dom,
	cacheDom,
	createEnhancedUi,
	validateApiKeyField,
	validateRegionField,
	clearValidationState,
	toggleApiKeyVisibility,
	showView,
	setLoadingProgress,
	renderHistory,
	renderResult,
	getErrorMessage,
} = require('./ui');

/* ---------- Request tracking ---------- */

let activeRequestId = 0; // lets us ignore results from superseded/cancelled requests

/**
 * Invalidates any in-flight request so its result is never rendered.
 * @returns {void}
 */
function cancelActiveRequest() {
	activeRequestId += 1;
}

/* ---------- Main flow ---------- */

/**
 * Loads and displays carbon usage for a region.
 *
 * Flow: fresh cache hit -> show immediately. Otherwise fetch from the API with
 * retries and exponential backoff (progress shown in the loading state), cache
 * the response for 30 minutes, append it to the history, and render it. If every
 * attempt fails but an older cached reading exists, that reading is shown with a
 * notice instead of an error.
 *
 * @param {string} apiKey - The India Energy Maps API key.
 * @param {string} region - Energy Maps zone, e.g. "western".
 * @param {DisplayOptions} [options] - Optional behaviour flags.
 * @returns {Promise<CarbonData|null>} The displayed data, or null if it failed or was cancelled.
 */
async function displayCarbonUsage(apiKey, region, options = {}) {
	const { forceRefresh = false } = options;
	activeRequestId += 1;
	const requestId = activeRequestId;
	const isCancelled = () => requestId !== activeRequestId;

	const cached = readCacheEntry(region);

	// 1) Fresh cache: no network, no loading state
	if (!forceRefresh && cached && isCacheFresh(cached)) {
		renderResult(region, cached.data, { kind: 'cache', timestamp: cached.timestamp });
		renderHistory(getHistory());
		showView('result');
		return cached.data;
	}

	// 2) Fetch with retries, showing progress
	showView('loading');
	setLoadingProgress('Contacting India Energy Maps...', 0);

	try {
		const data = await fetchWithRetry(apiKey, region, {
			onProgress: setLoadingProgress,
			isCancelled,
		});

		const entry = writeCacheEntry(region, data);
		addHistoryEntry(region, data, entry.timestamp);

		renderResult(region, data, { kind: 'network', timestamp: entry.timestamp });
		renderHistory(getHistory());
		showView('result');
		return data;
	} catch (error) {
		if (error instanceof CancelledError || isCancelled()) {
			return null; // a newer request or a reset owns the UI now
		}
		console.error(error);

		// 3) Fall back to older cached data rather than showing an error
		if (cached) {
			renderResult(region, cached.data, { kind: 'stale-cache', timestamp: cached.timestamp });
			renderHistory(getHistory());
			showView('result');
			return cached.data;
		}

		dom.errors.textContent = getErrorMessage(error);
		renderHistory(getHistory());
		showView('error');
		return null;
	}
}

/**
 * Decides the initial view from stored credentials.
 * First-time users get the default (green) toolbar icon; returning users get
 * the icon color for their latest data once it is rendered.
 * @returns {void}
 */
function init() {
	const { apiKey, region } = getStoredCredentials();

	if (!apiKey || !region || !VALID_ZONES.includes(region.trim().toLowerCase())) {
		clearCredentials();
		setDefaultIconColor();
		showView('setup'); // first-time user
		return;
	}

	displayCarbonUsage(apiKey, region); // returning user
}

/**
 * Clears credentials and form state, cancels any in-flight request, resets the
 * toolbar icon to its default color, and returns to setup.
 * @returns {void}
 */
function reset() {
	cancelActiveRequest();
	clearCredentials();
	setDefaultIconColor();

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
	const region = dom.regionInput.value.trim().toLowerCase();

	saveCredentials(apiKey, region);
	displayCarbonUsage(apiKey, region);
}

/* ---------- Bootstrap ---------- */

/**
 * Attaches all event listeners.
 * @returns {void}
 */
function setupEventListeners() {
	dom.apiInput.addEventListener('input', validateApiKeyField);
	dom.toggleApiKeyButton.addEventListener('click', toggleApiKeyVisibility);
	dom.form.addEventListener('submit', handleSubmit);
	dom.clearBtn.addEventListener('click', reset);
}

/**
 * Starts the popup. Does nothing outside a browser (e.g. in Node tests) or
 * when a required DOM element is missing.
 *
 * Steps, in order:
 * 1. {@link cacheDom} - find and store the required DOM elements.
 * 2. {@link createEnhancedUi} - create the progress bar, data-source note and history list.
 * 3. {@link setupEventListeners} - attach all event handlers.
 * 4. {@link init} - choose the first view based on saved credentials.
 *
 * @returns {boolean} True if the app started, false if it was skipped.
 */
function bootstrap() {
	if (typeof document === 'undefined' || !cacheDom()) {
		return false;
	}

	createEnhancedUi();
	setupEventListeners();
	init();
	return true;
}

module.exports = { bootstrap };
