const { GeminiEstimator, StorageManager, getEstimator } = require('./lib');

// Keep backwards compatibility for contexts that still expect globals when the
// bundler is bypassed (e.g., direct script inclusion during manual testing).
if (typeof window !== 'undefined') {
    window.GeminiEstimator = GeminiEstimator;
    window.StorageManager = StorageManager;
    window.getEstimator = getEstimator;
}

module.exports = {
    GeminiEstimator,
    StorageManager,
    getEstimator
};
