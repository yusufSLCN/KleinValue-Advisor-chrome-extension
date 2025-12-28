const { buildEstimationPrompt, parseEstimatorResponse } = require('./estimation-core');

class OpenAIEstimator {
    constructor(apiKey, settings = {}) {
        this.apiKey = apiKey;
        this.modelName = settings.modelName || 'gpt-4.1-mini';
        this.temperature = clampNumber(settings.temperature, 0, 2, 0.2);
        this.topP = clampNumber(settings.topP, 0, 1, 1);
    }

    async estimateValue(itemData) {
        const prompt = buildEstimationPrompt(itemData, false);

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: this.modelName,
                    temperature: this.temperature,
                    top_p: this.topP,
                    max_tokens: 900,
                    messages: [
                        {
                            role: 'system',
                            content:
                                'You are an expert marketplace appraiser. Respond ONLY with JSON that matches the requested schema.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ]
                })
            });

            if (!response.ok) {
                const errJson = await safeJson(response);
                throw new Error(errJson?.error?.message || `OpenAI API HTTP ${response.status}`);
            }

            const data = await response.json();
            const messageContent = data?.choices?.[0]?.message?.content;
            const textOutput = Array.isArray(messageContent)
                ? messageContent.map((part) => part?.text || part || '').join('\n')
                : messageContent || '';

            const result = parseEstimatorResponse(textOutput);
            result.model = this.modelName;
            result.provider = 'openai';
            result.providerName = 'OpenAI GPT';
            result.estimatedCost = this.estimateCost(data?.usage);
            return result;
        } catch (error) {
            console.warn('OpenAI API failed:', error);
            return {
                error: true,
                errorMessage: error.message || 'API request failed',
                value: null,
                reasoning: 'Analysis failed - please check your API key and try again',
                confidence: 0,
                model: this.modelName,
                provider: 'openai',
                providerName: 'OpenAI GPT'
            };
        }
    }

    estimateCost(usage) {
        if (!usage) {
            return null;
        }

        const promptTokens = usage.prompt_tokens || usage.total_tokens || 0;
        const completionTokens = usage.completion_tokens || 0;
        const totalTokens = usage.total_tokens || promptTokens + completionTokens;
        return {
            provider: 'openai',
            promptTokens,
            completionTokens,
            totalTokens,
            formatted: `~${totalTokens} tokens (OpenAI)`
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

module.exports = OpenAIEstimator;
