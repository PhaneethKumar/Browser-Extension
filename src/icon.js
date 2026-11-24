/**
 * Toolbar icon logic: turns a carbon intensity into a color and asks the
 * background service worker (background.js) to redraw the icon.
 *
 * @module icon
 */

const { CO2_SCALE, CO2_COLORS, DEFAULT_ICON_COLOR } = require('./config');

/**
 * Sends a color to the background service worker, which redraws the toolbar icon.
 * Safe to call outside the extension (tests, plain browser tab).
 * @param {string} color - Any CSS color.
 * @returns {void}
 */
function sendIconColor(color) {
	if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
		return;
	}
	try {
		chrome.runtime
			.sendMessage({ action: 'updateIcon', value: { color } })
			.then((response) => {
				if (response?.success) {
					console.log('Icon updated');
				} else {
					console.warn('Icon update failed:', response?.error);
				}
			})
			.catch((error) => {
				console.warn('Message delivery failed:', error);
			});
	} catch (error) {
		console.warn('Could not update icon', error);
	}
}

/**
 * Maps a carbon intensity to the color of the closest point on the CO2 scale.
 * @param {number} value - Grams of CO2 per kWh.
 * @returns {string} Hex color.
 */
function getColorForIntensity(value) {
	let closestIndex = 0;
	CO2_SCALE.forEach((point, index) => {
		if (Math.abs(point - value) < Math.abs(CO2_SCALE[closestIndex] - value)) {
			closestIndex = index;
		}
	});
	return CO2_COLORS[closestIndex];
}

/**
 * Calculates the icon color for a carbon intensity and tells the background script to draw it.
 * @param {number} value - Grams of CO2 per kWh.
 * @returns {string} The color that was sent.
 */
function calculateColor(value) {
	const color = getColorForIntensity(value);
	sendIconColor(color);
	return color;
}

/**
 * Sets the toolbar icon to the default (green) dot.
 * @returns {void}
 */
function setDefaultIconColor() {
	sendIconColor(DEFAULT_ICON_COLOR);
}

module.exports = {
	sendIconColor,
	getColorForIntensity,
	calculateColor,
	setDefaultIconColor,
};
