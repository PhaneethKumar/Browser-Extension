/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./src/index.js"
/*!**********************!*\
  !*** ./src/index.js ***!
  \**********************/
(module) {

eval("{const API_KEY_MIN_LENGTH = 20;\nconst REGION_CODE_PATTERN = /^[A-Z]{2}-[A-Z0-9]+$/;\n\nfunction isValidApiKey(apiKey) {\n\treturn apiKey.trim().length >= API_KEY_MIN_LENGTH;\n}\n\nfunction isValidRegionCode(regionCode) {\n\treturn REGION_CODE_PATTERN.test(regionCode.trim());\n}\n\nfunction setValidationState(input, feedback, isValid, message) {\n\tinput.classList.toggle('is-valid', isValid);\n\tinput.classList.toggle('is-invalid', !isValid);\n\tinput.setAttribute('aria-invalid', String(!isValid));\n\tfeedback.textContent = message;\n}\n\nfunction validateApiKeyField(input, feedback) {\n\tconst isValid = isValidApiKey(input.value);\n\tconst message = isValid ? 'API key looks valid.' : `API key must be at least ${API_KEY_MIN_LENGTH} characters.`;\n\tsetValidationState(input, feedback, isValid, message);\n\treturn isValid;\n}\n\nfunction validateRegionField(input, feedback) {\n\tconst isValid = isValidRegionCode(input.value);\n\tconst message = isValid ? 'Region code looks valid.' : 'Use a format such as US-NEISO.';\n\tsetValidationState(input, feedback, isValid, message);\n\treturn isValid;\n}\n\nfunction setupForm() {\n\tconst form = document.querySelector('.form-data');\n\tconst apiInput = document.querySelector('#api');\n\tconst apiFeedback = document.querySelector('#api-feedback');\n\tconst regionInput = document.querySelector('#region');\n\tconst regionFeedback = document.querySelector('#region-feedback');\n\tconst toggleApiKeyButton = document.querySelector('.toggle-api-key');\n\n\tif (!form || !apiInput || !apiFeedback || !regionInput || !regionFeedback || !toggleApiKeyButton) {\n\t\treturn;\n\t}\n\n\tapiInput.addEventListener('input', () => validateApiKeyField(apiInput, apiFeedback));\n\tregionInput.addEventListener('input', () => validateRegionField(regionInput, regionFeedback));\n\n\ttoggleApiKeyButton.addEventListener('click', () => {\n\t\tconst isHidden = apiInput.type === 'password';\n\t\tapiInput.type = isHidden ? 'text' : 'password';\n\t\ttoggleApiKeyButton.textContent = isHidden ? 'Hide' : 'Show';\n\t\ttoggleApiKeyButton.setAttribute('aria-pressed', String(isHidden));\n\t});\n\n\tform.addEventListener('submit', (event) => {\n\t\tconst apiKeyIsValid = validateApiKeyField(apiInput, apiFeedback);\n\t\tconst regionIsValid = validateRegionField(regionInput, regionFeedback);\n\n\t\tif (!apiKeyIsValid || !regionIsValid) {\n\t\t\tevent.preventDefault();\n\t\t}\n\t});\n}\n\nif (typeof document !== 'undefined') {\n\tsetupForm();\n}\n\nif (true) {\n\tmodule.exports = { isValidApiKey, isValidRegionCode };\n}\n\n\n//# sourceURL=webpack://carbon-trigger-extension/./src/index.js?\n}");

/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Check if module exists (development only)
/******/ 		if (__webpack_modules__[moduleId] === undefined) {
/******/ 			var e = new Error("Cannot find module '" + moduleId + "'");
/******/ 			e.code = 'MODULE_NOT_FOUND';
/******/ 			throw e;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__("./src/index.js");
/******/ 	
/******/ })()
;