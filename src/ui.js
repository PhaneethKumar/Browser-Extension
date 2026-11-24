/**
 * Everything that reads or changes the popup page: finding elements,
 * building the extra UI, showing views, rendering results and form feedback.
 * No other file calls document.querySelector or edits the page directly.
 *
 * @module ui
 */

const { TOTAL_ATTEMPTS, HISTORY_DISPLAY_COUNT, API_KEY_MIN_LENGTH } = require('./config');
const { isValidApiKey, isValidRegionCode } = require('./validation');
const { calculateColor } = require('./icon');

/* ---------- DOM references (queried once) ---------- */

/**
 * Cached DOM elements. Filled in by {@link cacheDom}; shared with other files
 * that need to read form values.
 * @type {Object<string, HTMLElement>}
 */
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

/* ---------- Form validation feedback ---------- */

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
	const message = isValid ? 'Zone looks valid.' : 'Select one of the available Energy Maps zones.';
	setValidationState(dom.regionInput, dom.regionFeedback, isValid, message);
	return isValid;
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

/* ---------- Views ---------- */

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

/* ---------- Rendering ---------- */

/**
 * Renders the most recent history entries into the history list.
 * @param {HistoryEntry[]} history - Saved readings, newest first.
 * @returns {void}
 */
function renderHistory(history) {
	const entries = history.slice(0, HISTORY_DISPLAY_COUNT);
	dom.historyList.textContent = '';

	entries.forEach((entry) => {
		const item = document.createElement('li');
		const when = new Date(entry.timestamp).toLocaleString();
		const fossilFuel =
			Number.isFinite(entry.fossilFuelPercentage) ? `${entry.fossilFuelPercentage.toFixed(1)}% fossil fuels` : 'fossil share unavailable';
		item.textContent =
			`${when} - ${entry.region}: ${Math.round(entry.carbonIntensity)} g/kWh, ` +
			fossilFuel;
		dom.historyList.appendChild(item);
	});
}

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
 * Writes carbon data and its source note into the result area, and updates
 * the toolbar icon color to match the carbon intensity.
 * @param {string} region - Region code.
 * @param {CarbonData} data - Data to display.
 * @param {RenderSource} source - Where the data came from.
 * @returns {void}
 */
function renderResult(region, data, source) {
	calculateColor(data.carbonIntensity);

	dom.myRegion.textContent = region;
	dom.carbonUsage.textContent = `${Math.round(data.carbonIntensity)} grams (grams CO2 emitted per kilowatt hour)`;
	dom.fossilFuel.textContent = Number.isFinite(data.fossilFuelPercentage)
		? `${data.fossilFuelPercentage.toFixed(2)}% (percentage of fossil fuels used to generate electricity)`
		: 'Not provided by the Energy Maps API';

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
	if (error.code === 'ERR_NETWORK') {
		return 'The Energy Maps API could not be reached. Check the extension network permissions and try again.';
	}
	return `Sorry, we could not reach the carbon data service after ${TOTAL_ATTEMPTS} attempts. Please try again later.`;
}

module.exports = {
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
	formatAge,
	renderResult,
	getErrorMessage,
};
