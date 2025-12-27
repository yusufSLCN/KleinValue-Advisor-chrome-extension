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
        const prompt = this.buildPrompt(itemData, withImages);

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

            const result = this.parseResponse(text);

            // Add model information
            result.model = this.modelName;

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

    buildPrompt(itemData, withImages = false) {
        const listedPriceLine = itemData.price != null ? `Listed Price: €${itemData.price}` : 'Listed Price: Unknown';
        const imagesList = !withImages && Array.isArray(itemData.images) && itemData.images.length
            ? itemData.images.map((u, i) => `- ${i + 1}. ${u}`).join('\n')
            : '- None';

        let prompt = `You are an expert appraiser for consumer goods on Kleinanzeigen. Use ALL provided information (title, description, product specifications within the description if present, location${withImages ? ', and images' : ' and image URLs'}) to estimate a fair market value in Euros.

Return ONLY a JSON object with this exact schema, no extra text, markdown, or explanations:
{"value": number, "reasoning": string, "confidence": number}

Rules:
- "value" must be a numeric Euro amount (can be decimal). Do NOT include currency symbols or units in the JSON, only the number.
- "confidence" must be a number between 0-100 representing your confidence in the estimate (0 = very uncertain, 100 = absolutely certain).
- Base your estimate on description and product specs${withImages ? '; analyze the provided images for condition, quality, and features' : '; you may treat image URLs as additional context but you cannot fetch them'}.
- Keep "reasoning" concise (1-3 sentences).

Item Data:
Title: ${itemData.title}
Location: ${itemData.location || 'Unknown'}
${listedPriceLine}
Description (may include "Product Specifications:"):
${itemData.description || 'No description available'}
`;

        if (withImages) {
            prompt += `
📸 IMAGES ARE PROVIDED: Analyze the images to assess the item's condition, quality, and features.

Consider when estimating value:
- Visual condition and quality from images
- Brand recognition visible in images
- Wear and tear visible in photos
- Overall appearance and presentation
`;
        } else {
            prompt += `
Images (URLs):
${imagesList}

Consider when estimating value:
- Condition based on text description
- Brand recognition from description
`;
        }

        return prompt;
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

    parseResponse(response) {
        try {
            let text = typeof response === 'string' ? response : String(response ?? '');
            text = text.trim();

            // Normalize possible code fences
            text = this.stripCodeFences(text);

            // 1) Try strict JSON
            try {
                const obj = JSON.parse(text);
                const rawValue = obj.value ?? obj.price ?? obj.estimated_value ?? obj.estimate;
                const value = this.parseNumericEuro(rawValue);
                const reasoning = String(obj.reasoning ?? obj.reason ?? obj.explanation ?? '').trim();
                const confidence = typeof obj.confidence === 'number' ? Math.max(0, Math.min(100, obj.confidence)) : 70;
                if (value !== null) {
                    return {
                        value,
                        reasoning: reasoning || 'No reasoning provided',
                        confidence
                    };
                }
            } catch (_) {
                // 2) Try to extract first JSON object substring and parse it
                const jsonStr = this.extractFirstJsonObjectString(text);
                if (jsonStr) {
                    try {
                        const obj = JSON.parse(jsonStr);
                        const rawValue = obj.value ?? obj.price ?? obj.estimated_value ?? obj.estimate;
                        const value = this.parseNumericEuro(rawValue);
                        const reasoning = String(obj.reasoning ?? obj.reason ?? obj.explanation ?? '').trim();
                        const confidence = typeof obj.confidence === 'number' ? Math.max(0, Math.min(100, obj.confidence)) : 70;
                        if (value !== null) {
                            return {
                                value,
                                reasoning: reasoning || 'No reasoning provided',
                                confidence
                            };
                        }
                    } catch (_) {
                        // continue
                    }
                }
            }

            // 3) Try to read a "value" field via regex even if JSON parsing failed
            const jsonValueMatch = text.match(/"value"\s*:\s*([\-]?\d[\d.,]*)/i);
            if (jsonValueMatch) {
                const num = this.parseNumericEuro(jsonValueMatch[1]);
                if (num !== null) {
                    return {
                        value: num,
                        reasoning: 'No reasoning provided'
                    };
                }
            }

            // 4) VALUE: <number> pattern
            let value = null;
            const valueLine = text.match(/^\s*VALUE\s*[:\-]\s*([€]?\s*\d[\d.,]*)/im);
            if (valueLine && valueLine[1]) {
                value = this.parseNumericEuro(valueLine[1]);
            }

            // 5) First euro-formatted number
            if (value === null) {
                const euroMatch = text.match(/[€]\s*\d[\d.,]*/);
                if (euroMatch) {
                    value = this.parseNumericEuro(euroMatch[0]);
                }
            }

            // 6) First general number
            if (value === null) {
                const numMatch = text.match(/\b\d[\d.,]{1,}\b/);
                if (numMatch) {
                    value = this.parseNumericEuro(numMatch[0]);
                }
            }

            // Reasoning extraction
            let reasoning = '';
            const reasoningMatch = text.match(/^\s*REASONING\s*[:\-]\s*(.+)$/im);
            if (reasoningMatch && reasoningMatch[1]) {
                reasoning = reasoningMatch[1].trim();
            } else {
                // If no explicit reasoning key, use the text (truncated)
                reasoning = text.length > 500 ? text.slice(0, 500) + '...' : text;
            }

            return {
                value: value !== null ? value : 0,
                reasoning: reasoning || 'No reasoning provided',
                confidence: 50 // Default low confidence for fallback parsing
            };
        } catch (_) {
            return { value: 0, reasoning: 'No reasoning provided' };
        }
    }

    // Convert various euro representations (e.g., "€1.234,56", "1,234.56", 1234) into a Number
    parseNumericEuro(input) {
        if (input === null || input === undefined) return null;
        if (typeof input === 'number' && isFinite(input)) {
            // round to 2 decimals to keep UI consistent
            return Math.round(input * 100) / 100;
        }
        let s = String(input).trim();
        if (!s) return null;

        // Remove currency symbols and any non numeric separators
        // keep only digits, dot, comma and minus
        s = s.replace(/[^\d.,-]/g, '');

        // Heuristic: if there is a comma and it's after the last dot, treat comma as decimal separator (German style)
        if (s.includes(',') && s.lastIndexOf(',') > s.lastIndexOf('.')) {
            s = s.replace(/\./g, '');    // remove thousands dots
            s = s.replace(',', '.');     // convert decimal comma to dot
        } else {
            // otherwise, treat dot as decimal, remove commas as thousands separators
            s = s.replace(/,/g, '');
        }

        const num = parseFloat(s);
        if (!isFinite(num) || isNaN(num)) return null;

        return Math.round(num * 100) / 100;
    }

    // Strip ```json ... ``` or ``` ... ``` fences
    stripCodeFences(text) {
        if (!text) return text;
        const fenceMatch = text.match(/^```(?:json)?\n([\s\S]*?)\n```$/i);
        if (fenceMatch && fenceMatch[1]) {
            return fenceMatch[1].trim();
        }
        return text;
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

    // Extract the first balanced {...} JSON object substring
    extractFirstJsonObjectString(text) {
        if (!text) return null;
        const start = text.indexOf('{');
        if (start === -1) return null;

        let depth = 0;
        for (let i = start; i < text.length; i++) {
            const ch = text[i];
            if (ch === '{') depth++;
            else if (ch === '}') {
                depth--;
                if (depth === 0) {
                    const candidate = text.slice(start, i + 1).trim();
                    return candidate;
                }
            }
        }
        return null;
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
                    const unfenced = this.stripCodeFences(t);
                    const jsonObjStr = this.extractFirstJsonObjectString(unfenced);
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
