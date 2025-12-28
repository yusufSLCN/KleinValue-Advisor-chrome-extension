const {
    buildEstimationPrompt,
    parseEstimatorResponse
} = require('./estimation-core');

class AnthropicEstimator {
    constructor(apiKey, settings = {}) {
        this.apiKey = apiKey;
        this.modelName = settings.modelName || 'claude-3-5-sonnet-20241022';
        this.temperature = clampNumber(settings.temperature, 0, 1, 0.2);
    }

    async estimateValue(itemData) {
        const prompt = buildEstimationPrompt(itemData, false);

        try {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: this.modelName,
                    max_tokens: 900,
                    temperature: this.temperature,
                    system: 'You are KleinValue Advisor, an expert marketplace appraiser. Respond ONLY with JSON that matches the requested schema.',
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ]
                })
            });

            if (!response.ok) {
                const errJson = await safeJson(response);
                throw new Error(errJson?.error?.message || `Anthropic API HTTP ${response.status}`);
            }

            const data = await response.json();
            const contentBlocks = Array.isArray(data?.content) ? data.content : [];
            const textOutput = contentBlocks
                .map(block => block?.text || (Array.isArray(block?.content) ? block.content.map(part => part?.text || '').join('\n') : ''))
                .join('\n');

            const result = parseEstimatorResponse(textOutput);
            result.model = this.modelName;
            result.provider = 'anthropic';
            result.providerName = 'Anthropic Claude';
            result.estimatedCost = this.estimateCost(data?.usage);
            return result;
        } catch (error) {
            console.warn('Anthropic API failed:', error);
            return {
                error: true,
                errorMessage: error.message || 'API request failed',
                value: null,
                reasoning: 'Analysis failed - please check your API key and try again',
                confidence: 0,
                model: this.modelName,
                provider: 'anthropic',
                providerName: 'Anthropic Claude'
            };
        }
    }

    estimateCost(usage) {
        if (!usage) {
            return null;
        }

        const promptTokens = usage.input_tokens || 0;
        const completionTokens = usage.output_tokens || 0;
        const totalTokens = promptTokens + completionTokens;
        return {
            provider: 'anthropic',
            promptTokens,
            completionTokens,
            totalTokens,
            formatted: `~${totalTokens} tokens (Anthropic)`
        };
    }
}

function clampNumber(value, min, max, fallback) {
    const num = typeof value === 'number' ? value : parseFloat(value);
    if (!Number.isFinite(num)) {
        return fallback;
    }
    if (num < min) return min;
    if (num > max) return max;
    return num;
}

async function safeJson(response) {
    try {
        return await response.json();
    } catch (error) {
        return null;
    }
}

module.exports = AnthropicEstimator;
