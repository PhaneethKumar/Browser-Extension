const API_KEY_MIN_LENGTH = 20;
const REGION_CODE_PATTERN = /^[A-Z]{2}(?:-[A-Z0-9]+)*$/;

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

function validateApiKeyField(input, feedback) {
	const isValid = isValidApiKey(input.value);
	const message = isValid ? 'API key looks valid.' : `API key must be at least ${API_KEY_MIN_LENGTH} characters.`;
	setValidationState(input, feedback, isValid, message);
	return isValid;
}

function validateRegionField(input, feedback) {
	const isValid = isValidRegionCode(input.value);
	const message = isValid ? 'Region code looks valid.' : 'Use a format such as US-NEISO.';
	setValidationState(input, feedback, isValid, message);
	return isValid;
}

function setupForm() {
	const form = document.querySelector('.form-data');
	const apiInput = document.querySelector('#api');
	const apiFeedback = document.querySelector('#api-feedback');
	const regionInput = document.querySelector('#region');
	const regionFeedback = document.querySelector('#region-feedback');
	const toggleApiKeyButton = document.querySelector('.toggle-api-key');

	if (!form || !apiInput || !apiFeedback || !regionInput || !regionFeedback || !toggleApiKeyButton) {
		return;
	}

	apiInput.addEventListener('input', () => validateApiKeyField(apiInput, apiFeedback));
	regionInput.addEventListener('input', () => validateRegionField(regionInput, regionFeedback));

	toggleApiKeyButton.addEventListener('click', () => {
		const isHidden = apiInput.type === 'password';
		apiInput.type = isHidden ? 'text' : 'password';
		toggleApiKeyButton.textContent = isHidden ? 'Hide' : 'Show';
		toggleApiKeyButton.setAttribute('aria-pressed', String(isHidden));
	});

	form.addEventListener('submit', (event) => {
		event.preventDefault();

		const regionIsValid = validateRegionField(regionInput, regionFeedback);
		const apiKeyIsValid = validateApiKeyField(apiInput, apiFeedback);

		if (!regionIsValid) {
			regionInput.focus();
			return;
		}

		if (!apiKeyIsValid) {
			apiInput.focus();
			return;
		}

		// Both fields are valid: the API request / result display goes here.
	});
}

if (typeof document !== 'undefined') {
	setupForm();
}

if (typeof module !== 'undefined') {
	module.exports = { isValidApiKey, isValidRegionCode };
}