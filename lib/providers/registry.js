const { PROVIDERS, PROVIDER_MAP, getProviderMeta } = require('./metadata');
const GeminiEstimator = require('../gemini-estimator');
const OpenAIEstimator = require('../openai-estimator');
const AnthropicEstimator = require('../anthropic-estimator');

const ESTIMATOR_MAP = {
    gemini: GeminiEstimator,
    openai: OpenAIEstimator,
    anthropic: AnthropicEstimator
};

function getProviderConfig(id) {
    const meta = getProviderMeta(id);
    const Estimator = ESTIMATOR_MAP[meta.id];
    return {
        ...meta,
        Estimator
    };
}

module.exports = {
    PROVIDERS,
    PROVIDER_MAP,
    getProviderMeta,
    getProviderConfig
};
