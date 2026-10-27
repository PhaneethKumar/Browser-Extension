// Background service worker for My Carbon Trigger.
// Receives color updates from the popup (src/index.js -> main.js)
// and redraws the toolbar icon as a colored dot.

const DEFAULT_COLOR = 'green';

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg && msg.action === 'updateIcon' && msg.value && msg.value.color) {
        chrome.action.setIcon({ imageData: drawIcon(msg.value) });
    }
});

// Show the default (green) dot as soon as the extension is installed or the browser starts,
// so the toolbar never shows a blank/default puzzle icon before the popup has been opened.
chrome.runtime.onInstalled.addListener(function () {
    chrome.action.setIcon({ imageData: drawIcon({ color: DEFAULT_COLOR }) });
});

chrome.runtime.onStartup.addListener(function () {
    chrome.action.setIcon({ imageData: drawIcon({ color: DEFAULT_COLOR }) });
});

// Draw dynamic icon using Canvas API
// Borrowed from energy lollipop extension - nice feature!
function drawIcon(value) {
    // Create an offscreen canvas (the only canvas available in a service worker)
    const canvas = new OffscreenCanvas(200, 200);
    const context = canvas.getContext('2d');

    // Draw a colored circle representing carbon intensity
    context.beginPath();
    context.fillStyle = value.color;
    context.arc(100, 100, 50, 0, 2 * Math.PI);
    context.fill();

    // Return the image data for the browser icon
    return context.getImageData(50, 50, 100, 100);
}