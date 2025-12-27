const GeminiEstimator = require('./gemini-estimator');
const StorageManager = require('./storage-manager');

let globalEstimator = null;

async function getEstimator() {
    const apiKey = await StorageManager.getApiKey();
    if (!apiKey) {
        throw new Error('API key not configured. Please set it in extension settings.');
    }

    // Always load fresh settings to ensure we have the latest model selection
    const settings = await StorageManager.getSettings();
    console.log('getEstimator - Loaded settings:', settings);
    console.log('getEstimator - Loaded settings.modelName:', settings.modelName);

    // Check if we need to create a new estimator (different model or first time)
    console.log('Current globalEstimator model:', globalEstimator?.modelName);
    console.log('Settings model:', settings.modelName);
    console.log('Comparison result:', globalEstimator?.modelName !== settings.modelName);

    if (!globalEstimator || globalEstimator.modelName !== settings.modelName) {
        console.log('Creating new estimator with model:', settings.modelName);
        globalEstimator = new GeminiEstimator(apiKey, settings);
    } else {
        console.log('Reusing existing estimator with model:', globalEstimator.modelName);
    }

    return globalEstimator;
}

module.exports = {
    getEstimator,
    StorageManager,
    GeminiEstimator
};
