const {
    buildEstimationPrompt,
    parseEstimatorResponse,
    stripCodeFences,
    extractFirstJsonObjectString
} = require('./estimation-core');

// GeminiEstimator handles all Gemini API interactions, including prompt
// construction, response parsing, and cost estimation.
class GeminiEstimator {
    constructor(apiKey, settings = {}) {
        console.log('GeminiEstimator constructor called with apiKey:', apiKey ? '***' : 'null');
        console.log('GeminiEstimator constructor called with settings:', settings);
        console.log('settings.modelName:', settings.modelName);
        this.apiKey = apiKey;
        this.modelName = settings.modelName || 'gemini-2.5-flash';
        this.maxImages = settings.maxImages || 4;
        this.enableImages = settings.enableImages !== false; // Default true
        this.temperature = this.clampNumber(settings.temperature, 0, 2, 0);
        this.topP = this.clampNumber(settings.topP, 0, 1, 1);
        this.topK = this.normalizeTopK(settings.topK);
        this.randomSeed = this.normalizeSeed(settings.randomSeed);
        console.log('GeminiEstimator created with model:', this.modelName);
        console.log('GeminiEstimator generationConfig:', {
            temperature: this.temperature,
            topP: this.topP,
            topK: this.topK,
            seed: this.randomSeed
        });
    }

    async estimateValue(itemData) {
        const hasImages = itemData.images && itemData.images.length > 0 && this.enableImages;
        const images = hasImages ? await this.loadImages(itemData.images) : [];
        console.log('Number of extracted images: ', images.length);
        const withImages = images.length > 0;
        const prompt = buildEstimationPrompt(itemData, withImages);

        let parts = [{ text: prompt }];
        if (withImages) {
            parts = parts.concat(images);
        }

        console.log(prompt);
        console.log('Making API call with model:', this.modelName);
        const generationConfig = this.buildGenerationConfig();
        console.log('Using generation config:', generationConfig);
        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${encodeURIComponent(this.apiKey)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: parts
                        }
                    ],
                    generationConfig
                })
            });

            if (!res.ok) {
                const errText = await res.text().catch(() => '');
                throw new Error(`Gemini API HTTP ${res.status}: ${errText}`);
            }

            const data = await res.json();
            const text = this.extractTextFromGeminiResponse(data);

            if (!text) {
                throw new Error('Empty AI response');
            }

            const result = parseEstimatorResponse(text);

            // Add model information
            result.model = this.modelName;
            result.provider = 'gemini';
            result.providerName = 'Google Gemini';

            // Estimate cost based on model and usage
            result.estimatedCost = this.estimateCost(data, this.modelName);

            return result;
        } catch (error) {
            console.warn('Gemini API failed:', error);
            return {
                error: true,
                errorMessage: error.message || 'API request failed',
                value: null,
                reasoning: 'Analysis failed - please check your API key and try again',
                confidence: 0,
                model: this.modelName
            };
        }
    }

    buildGenerationConfig() {
        const config = {
            temperature: this.temperature,
            topP: this.topP,
            candidateCount: 1,
            seed: this.randomSeed
        };
        if (Number.isInteger(this.topK) && this.topK > 0) {
            config.topK = this.topK;
        }
        return config;
    }

    clampNumber(value, min, max, fallback) {
        const num = typeof value === 'number' ? value : parseFloat(value);
        if (!Number.isFinite(num)) {
            return fallback;
        }
        if (num < min) return min;
        if (num > max) return max;
        return num;
    }

    normalizeSeed(value) {
        const num = Number(value);
        if (Number.isInteger(num) && num >= 0 && num <= 2147483647) {
            return num;
        }
        return 1337;
    }

    normalizeTopK(value) {
        const num = Number(value);
        if (Number.isInteger(num) && num > 0) {
            return num;
        }
        return undefined;
    }

    extractTextFromGeminiResponse(data) {
        try {
            // REST v1beta shape
            if (data && Array.isArray(data.candidates) && data.candidates.length > 0) {
                const candidate = data.candidates[0];
                const parts = candidate?.content?.parts || [];

                // Prefer JSON-looking parts that contain a "value" field
                for (const part of parts) {
                    const t = part?.text?.trim();
                    if (!t) continue;
                    const unfenced = stripCodeFences(t);
                    const jsonObjStr = extractFirstJsonObjectString(unfenced);
                    if (jsonObjStr && /"value"\s*:/.test(jsonObjStr)) {
                        return jsonObjStr;
                    }
                    if (/"value"\s*:/.test(unfenced)) {
                        // return raw part if it already looks like JSON but not strictly extractable
                        return unfenced;
                    }
                }

                // Fallback: join all text parts
                const textParts = parts.map(p => p?.text).filter(Boolean);
                if (textParts.length > 0) {
                    return textParts.join('\n');
                }
            }

            // Some SDKs return { response: { text() } }
            if (data && data.response && typeof data.response.text === 'function') {
                return data.response.text();
            }

            if (typeof data === 'string') {
                return data;
            }
        } catch (_) {
            // ignore
        }
        return '';
    }

    async loadImages(imageUrls) {
        const images = [];
        // Load up to maxImages setting to capture gallery images
        for (const url of imageUrls.slice(0, this.maxImages)) {
            try {
                const response = await fetch(url);
                if (!response.ok) continue;
                const blob = await response.blob();
                const base64 = await this.blobToBase64(blob);
                images.push({
                    inline_data: {
                        mime_type: response.headers.get('content-type') || 'image/jpeg',
                        data: base64
                    }
                });
            } catch (e) {
                console.warn('Failed to load image:', url, e);
            }
        }
        return images;
    }

    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    estimateCost(apiResponse, modelName) {
        // Gemini API pricing (as of 2025, per 1M tokens, converted to per 1K tokens)
        const pricing = {
            // Latest 2.5 models
            'gemini-2.5-pro': { input: 0.00125, output: 0.010 },
            'gemini-2.5-flash': { input: 0.0003, output: 0.0025 },
            'gemini-2.5-flash-lite': { input: 0.0001, output: 0.0004 },

            // 2.0 series
            'gemini-2.0-flash': { input: 0.0001, output: 0.0004 },

            // 1.5 series
            'gemini-1.5-pro-latest': { input: 0.00125, output: 0.005 },
            'gemini-1.5-flash-latest': { input: 0.000075, output: 0.0003 },
            'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
            'gemini-1.5-flash': { input: 0.000075, output: 0.0003 },

            // Legacy
            'gemini-pro': { input: 0.0005, output: 0.0015 }
        };

        const modelPricing = pricing[modelName] || pricing['gemini-1.5-flash-latest'];

        try {
            // Extract token usage from response
            const usage = apiResponse?.usageMetadata;
            if (usage) {
                const inputTokens = usage.promptTokenCount || 0;
                const outputTokens = usage.candidatesTokenCount || 0;

                const inputCost = (inputTokens / 1000) * modelPricing.input;
                const outputCost = (outputTokens / 1000) * modelPricing.output;
                const totalCost = inputCost + outputCost;

                return {
                    inputTokens,
                    outputTokens,
                    totalTokens: inputTokens + outputTokens,
                    cost: totalCost,
                    currency: 'USD',
                    formatted: `$${totalCost.toFixed(6)}`
                };
            }
        } catch (e) {
            console.warn('Error calculating cost:', e);
        }

        // Fallback estimation based on typical usage
        const estimatedInputTokens = 500; // Rough estimate for our prompts
        const estimatedOutputTokens = 100; // Rough estimate for responses

        const inputCost = (estimatedInputTokens / 1000) * modelPricing.input;
        const outputCost = (estimatedOutputTokens / 1000) * modelPricing.output;
        const totalCost = inputCost + outputCost;

        return {
            inputTokens: estimatedInputTokens,
            outputTokens: estimatedOutputTokens,
            totalTokens: estimatedInputTokens + estimatedOutputTokens,
            cost: totalCost,
            currency: 'USD',
            formatted: `$${totalCost.toFixed(6)} (estimated)`,
            isEstimated: true
        };
    }
}

module.exports = GeminiEstimator;
