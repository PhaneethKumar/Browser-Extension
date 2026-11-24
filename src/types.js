/**
 * Shared JSDoc type definitions.
 *
 * This file contains no runtime code and is never imported. It exists so the
 * data shapes used across the other files are documented in one place. The
 * types are global (no @module tag ) so any file can refer to them by name.
 */

/**
 * Carbon data returned by the India Energy Maps API.
 * @typedef {Object} CarbonData
 * @property {number} carbonIntensity - Grams of CO2 emitted per kilowatt hour.
 * @property {number|null} fossilFuelPercentage - Share of electricity generated from fossil fuels (0-100), when provided.
 */

/**
 * A cached API response.
 * @typedef {Object} CacheEntry
 * @property {number} timestamp - Epoch ms when the data was fetched.
 * @property {number} expiresAt - Epoch ms after which the entry is considered stale.
 * @property {CarbonData} data - The cached payload.
 */

/**
 * One previously fetched reading, shown in the history list.
 * @typedef {Object} HistoryEntry
 * @property {string} region - Region code the reading belongs to.
 * @property {number} timestamp - Epoch ms when the reading was fetched.
 * @property {number} carbonIntensity - Grams of CO2 per kWh.
 * @property {number} fossilFuelPercentage - Fossil fuel share (0-100).
 */

/**
 * Options for {@link displayCarbonUsage}.
 * @typedef {Object} DisplayOptions
 * @property {boolean} [forceRefresh=false] - Skip a fresh cache entry and call the API anyway.
 */

/**
 * Describes where displayed data came from.
 * @typedef {Object} RenderSource
 * @property {'network'|'cache'|'stale-cache'} kind
 * @property {number} timestamp - Epoch ms when the displayed data was fetched.
 */

/**
 * Callbacks that let {@link fetchWithRetry} report progress and detect
 * cancellation without knowing anything about the page.
 * @typedef {Object} FetchHooks
 * @property {(message: string, attempt: number) => void} [onProgress] - Called when the status text should change.
 * @property {() => boolean} [isCancelled] - Returns true once the request has been superseded.
 */
