const StorageManager = require('./storage-manager');
const { getProviderConfig } = require('./providers/registry');

let globalEstimator = null;
let globalEstimatorKey = null;

async function getEstimator() {
    const settings = await StorageManager.getSettings();
    const providerId = settings.provider || 'gemini';
    const providerConfig = getProviderConfig(providerId);
    const apiKey = await StorageManager.getApiKey(providerId);

    if (!apiKey) {
        throw new Error(`API key not configured for ${providerConfig.name}. Please set it in extension settings.`);
    }

    const estimatorKey = `${providerId}:${settings.modelName}`;
    const shouldCreate = !globalEstimator || globalEstimatorKey !== estimatorKey;

    if (shouldCreate) {
        console.log('Creating new estimator for provider:', providerId, 'model:', settings.modelName);
        globalEstimator = new providerConfig.Estimator(apiKey, {
            ...settings,
            modelName: settings.modelName
        });
        globalEstimatorKey = estimatorKey;
    } else {
        console.log('Reusing existing estimator for provider:', providerId, 'model:', settings.modelName);
    }

    return globalEstimator;
}

module.exports = {
    getEstimator,
    StorageManager
};
