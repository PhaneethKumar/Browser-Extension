const axios = require('axios');

/* ---------- Constants ---------- */

const STORAGE_KEYS = { apiKey: 'apiKey', region: 'regionName' };
const API_KEY_MIN_LENGTH = 20;
const REGION_CODE_PATTERN = /^[A-Z]{2}(?:-[A-Z0-9]+)*$/;

/* ---------- DOM references (queried once) ---------- */

const dom = {};

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

/* ---------- Validation ---------- */

function isValidApiKey(apiKey) {
	return apiKey.trim().length >= API_KEY_MIN_LENGTH;
}

function isValidRegionCode(regionCode) {
	return REGION_CODE_PATTERN.test(regionCode.trim());
}

function setValidationState(input, feedback, isValid, message) {
	input.classList.toggle('is-valid', isValid);
	input.classList.toggle('is-invalid', !isValid);
	feedback.classList.toggle('is-valid', isValid);
	feedback.classList.toggle('is-invalid', !isValid);
	input.setAttribute('aria-invalid', String(!isValid));
	feedback.textContent = message;
}

function clearValidationState(input, feedback) {
	input.classList.remove('is-valid', 'is-invalid');
	feedback.classList.remove('is-valid', 'is-invalid');
	input.removeAttribute('aria-invalid');
	feedback.textContent = '';
}

function validateApiKeyField() {
	const isValid = isValidApiKey(dom.apiInput.value);
	const message = isValid ? 'API key looks valid.' : `API key must be at least ${API_KEY_MIN_LENGTH} characters.`;
	setValidationState(dom.apiInput, dom.apiFeedback, isValid, message);
	return isValid;
}

function validateRegionField() {
	const isValid = isValidRegionCode(dom.regionInput.value);
	const message = isValid ? 'Region code looks valid.' : 'Use a format such as US-NEISO.';
	setValidationState(dom.regionInput, dom.regionFeedback, isValid, message);
	return isValid;
}

/* ---------- Storage ---------- */

function getStoredCredentials() {
	return {
		apiKey: localStorage.getItem(STORAGE_KEYS.apiKey),
		region: localStorage.getItem(STORAGE_KEYS.region),
	};
}

function saveCredentials(apiKey, region) {
	localStorage.setItem(STORAGE_KEYS.apiKey, apiKey);
	localStorage.setItem(STORAGE_KEYS.region, region);
}

function clearCredentials() {
	localStorage.removeItem(STORAGE_KEYS.apiKey);
	localStorage.removeItem(STORAGE_KEYS.region);
}

/* ---------- UI state ---------- */

// Single place that decides what the user sees: 'setup' | 'loading' | 'error' | 'result'
function showView(view) {
	const isSetup = view === 'setup';

	dom.form.hidden = !isSetup;
	dom.result.hidden = isSetup;
	dom.clearBtn.hidden = isSetup; // reset option only for returning users

	dom.loading.hidden = view !== 'loading';
	dom.errors.hidden = view !== 'error';
	dom.resultContainer.hidden = view !== 'result';
}

/* ---------- API + display ---------- */

async function displayCarbonUsage(apiKey, region) {
	showView('loading');
	try {
		// Adjust the endpoint/params to match the CO2 Signal API version you use.
		const response = await axios.get('https://api.co2signal.com/v1/latest', {
			params: { countryCode: region },
			headers: { 'auth-token': apiKey },
		});
		const { carbonIntensity, fossilFuelPercentage } = response.data.data;

		dom.myRegion.textContent = region;
		dom.carbonUsage.textContent = `${Math.round(carbonIntensity)} grams (grams CO2 emitted per kilowatt hour)`;
		dom.fossilFuel.textContent = `${fossilFuelPercentage.toFixed(2)}% (percentage of fossil fuels used to generate electricity)`;

		showView('result');
	} catch (error) {
		console.error(error);
		dom.errors.textContent = 'Sorry, we have no data for the region you requested, or the API key was rejected.';
		showView('error');
	}
}

/* ---------- App flow ---------- */

function init() {
	const { apiKey, region } = getStoredCredentials();

	if (!apiKey || !region) {
		showView('setup'); // first-time user
		return;
	}

	displayCarbonUsage(apiKey, region); // returning user
}

function reset() {
	clearCredentials();

	dom.apiInput.value = '';
	dom.regionInput.value = '';
	clearValidationState(dom.apiInput, dom.apiFeedback);
	clearValidationState(dom.regionInput, dom.regionFeedback);

	showView('setup');
}

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

function toggleApiKeyVisibility() {
	const isHidden = dom.apiInput.type === 'password';
	dom.apiInput.type = isHidden ? 'text' : 'password';
	dom.toggleApiKeyButton.textContent = isHidden ? 'Hide' : 'Show';
	dom.toggleApiKeyButton.setAttribute('aria-pressed', String(isHidden));
}

/* ---------- Bootstrap ---------- */

function setupEventListeners() {
	dom.apiInput.addEventListener('input', validateApiKeyField);
	dom.regionInput.addEventListener('input', validateRegionField);
	dom.toggleApiKeyButton.addEventListener('click', toggleApiKeyVisibility);
	dom.form.addEventListener('submit', handleSubmit);
	dom.clearBtn.addEventListener('click', reset);
}

if (typeof document !== 'undefined' && cacheDom()) {
	setupEventListeners();
	init();
}

if (typeof module !== 'undefined') {
	module.exports = { isValidApiKey, isValidRegionCode };
}