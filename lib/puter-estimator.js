const { buildEstimationPrompt, parseEstimatorResponse } = require('./estimation-core');

class PuterEstimator {
    constructor(_apiKey, settings = {}) {
        this.modelName = settings.modelName || 'gpt-5-nano';
        this.temperature = clampNumber(settings.temperature, 0, 2, 0.2);
        this.maxImages = settings.maxImages || 4;
        this.enableImages = settings.enableImages !== false;
    }

    async estimateValue(itemData) {
        const puter = getPuterClient();
        const prompt = buildEstimationPrompt(itemData, false);
        const images =
            this.enableImages && Array.isArray(itemData?.images)
                ? itemData.images.slice(0, this.maxImages).filter(Boolean)
                : [];
        const options = {
            model: this.modelName,
            temperature: this.temperature,
            max_tokens: 900
        };

        try {
            let response = await invokePuterChat(puter, prompt, images, options);

            if (isPuterAuthError(response)) {
                await ensurePuterSignedIn(puter);
                response = await invokePuterChat(puter, prompt, images, options);
            }

            if (isPuterAuthError(response)) {
                throw normalizePuterError(response);
            }

            const result = parsePuterEstimation(response);
            result.model = this.modelName;
            result.provider = 'puter';
            result.providerName = 'Puter.js';
            result.estimatedCost = this.estimateCost(response);
            return result;
        } catch (error) {
            if (isPuterAuthError(error)) {
                try {
                    await ensurePuterSignedIn(puter);
                    const retryResponse = await invokePuterChat(puter, prompt, images, options);

                    if (isPuterAuthError(retryResponse)) {
                        throw normalizePuterError(retryResponse);
                    }

                    const retryResult = parsePuterEstimation(retryResponse);
                    retryResult.model = this.modelName;
                    retryResult.provider = 'puter';
                    retryResult.providerName = 'Puter.js';
                    retryResult.estimatedCost = this.estimateCost(retryResponse);
                    return retryResult;
                } catch (retryError) {
                    error = retryError;
                }
            }

            console.warn('Puter API failed:', error);
            const errorMessage = getPuterErrorMessage(error);
            const reasoning = isPuterAuthError(error)
                ? 'Analysis failed - sign in to Puter (allow popup) and try again'
                : 'Analysis failed - please check Puter sign-in and try again';

            return {
                error: true,
                errorMessage,
                value: null,
                reasoning,
                confidence: 0,
                model: this.modelName,
                provider: 'puter',
                providerName: 'Puter.js'
            };
        }
    }

    estimateCost(response) {
        const usage = response?.usage || response?.usage_metadata || response?.metadata?.usage;
        if (!usage) {
            return null;
        }

        const promptTokens =
            usage.input_tokens || usage.prompt_tokens || usage.promptTokenCount || 0;
        const completionTokens =
            usage.output_tokens || usage.completion_tokens || usage.candidatesTokenCount || 0;
        const totalTokens = usage.total_tokens || promptTokens + completionTokens;

        return {
            provider: 'puter',
            promptTokens,
            completionTokens,
            totalTokens,
            formatted: `~${totalTokens} tokens (Puter)`
        };
    }
}

async function invokePuterChat(puter, prompt, images, options) {
    return images.length
        ? puter.ai.chat(prompt, images, false, options)
        : puter.ai.chat(prompt, options);
}

async function ensurePuterSignedIn(puter) {
    if (!puter?.auth?.signIn) {
        throw new Error('Puter sign-in is unavailable in this context.');
    }

    if (typeof window === 'undefined' || typeof window.open !== 'function') {
        throw new Error('Puter sign-in requires a browser window context.');
    }

    try {
        await puter.auth.signIn();
    } catch (error) {
        const message = getPuterErrorMessage(error).toLowerCase();
        if (
            message.includes('auth_window_closed') ||
            message.includes('popup') ||
            message.includes('closed by the user')
        ) {
            throw new Error('Puter sign-in popup was blocked or closed. Click Analyze again and allow popups.');
        }
        throw normalizePuterError(error);
    }
}

function isPuterAuthError(error) {
    if (!error) return false;

    const status =
        error?.status ||
        error?.statusCode ||
        error?.code ||
        error?.error?.statusCode ||
        error?.error?.status ||
        error?.error?.code;
    if (status === 401 || status === '401') {
        return true;
    }

    const text = safeStringify(error).toLowerCase();
    return (
        text.includes('unauthorized') ||
        text.includes('auth') ||
        text.includes('/whoami') ||
        text.includes('auth_window_closed')
    );
}

function normalizePuterError(error) {
    if (!error) {
        return new Error('Unknown Puter error');
    }

    if (error instanceof Error) {
        return error;
    }

    const message = getPuterErrorMessage(error);
    return new Error(message);
}

function getPuterErrorMessage(error) {
    if (!error) {
        return 'API request failed';
    }

    if (typeof error === 'string') {
        return error;
    }

    return (
        error.message ||
        error.msg ||
        error.error?.error?.message ||
        error.error?.message ||
        error.error?.msg ||
        safeStringify(error)
    );
}

function safeStringify(value) {
    try {
        const serialized = JSON.stringify(value);
        if (typeof serialized === 'string') {
            return serialized;
        }
    } catch (_error) {
    }

    try {
        return String(value || '');
    } catch (_error) {
        return '';
    }
}

function getPuterClient() {
    let restoreHTMLElement = null;

    try {
        if (shouldGuardPuterImport()) {
            restoreHTMLElement = temporarilyDisableHTMLElement();
        }

        const sdk = require('@heyputer/puter.js');
        const puterClient = sdk?.puter || sdk?.default?.puter || sdk?.default;
        if (!puterClient?.ai?.chat) {
            throw new Error('Puter SDK is unavailable in this context.');
        }
        return puterClient;
    } finally {
        if (typeof restoreHTMLElement === 'function') {
            restoreHTMLElement();
        }
    }
}

function shouldGuardPuterImport() {
    return (
        typeof globalThis !== 'undefined' &&
        typeof globalThis.HTMLElement !== 'undefined' &&
        (!globalThis.customElements || typeof globalThis.customElements.define !== 'function')
    );
}

function temporarilyDisableHTMLElement() {
    const hadOwnHTMLElement = Object.prototype.hasOwnProperty.call(globalThis, 'HTMLElement');
    const originalHTMLElement = globalThis.HTMLElement;

    try {
        Object.defineProperty(globalThis, 'HTMLElement', {
            value: undefined,
            configurable: true,
            writable: true
        });
    } catch (_error) {
        return null;
    }

    return () => {
        try {
            if (hadOwnHTMLElement) {
                Object.defineProperty(globalThis, 'HTMLElement', {
                    value: originalHTMLElement,
                    configurable: true,
                    writable: true
                });
            } else {
                delete globalThis.HTMLElement;
            }
        } catch (_restoreError) {
            globalThis.HTMLElement = originalHTMLElement;
        }
    };
}

function extractTextFromPuterResponse(response) {
    if (!response) {
        return '';
    }

    if (typeof response === 'string') {
        return response;
    }

    if (response?.text && typeof response.text === 'string') {
        return response.text;
    }

    if (response?.message?.content != null) {
        return normalizeContent(response.message.content);
    }

    if (response?.content != null) {
        return normalizeContent(response.content);
    }

    if (typeof response?.toString === 'function') {
        const value = response.toString();
        if (value && value !== '[object Object]') {
            return value;
        }
    }

    return JSON.stringify(response);
}

function parsePuterEstimation(response) {
    const candidates = collectPuterTextCandidates(response);

    for (const candidate of candidates) {
        if (!candidate || typeof candidate !== 'string') {
            continue;
        }

        const parsed = parseEstimatorResponse(candidate);
        if (isLikelyParsedEstimate(parsed)) {
            return parsed;
        }
    }

    for (const candidate of candidates) {
        const inferred = inferEuroEstimateFromText(candidate);
        if (inferred) {
            return inferred;
        }
    }

    return parseEstimatorResponse(extractTextFromPuterResponse(response));
}

function collectPuterTextCandidates(response) {
    const candidates = [];
    const push = (value) => {
        if (typeof value === 'string') {
            const v = value.trim();
            if (v) {
                candidates.push(v);
            }
        }
    };

    push(extractTextFromPuterResponse(response));
    push(response?.message?.content);
    push(response?.message?.text);
    push(response?.text);
    push(response?.content);
    push(response?.output_text);
    push(response?.result?.message?.content);
    push(response?.result?.text);

    if (Array.isArray(response?.message?.content)) {
        response.message.content.forEach((part) => {
            if (typeof part === 'string') {
                push(part);
                return;
            }
            push(part?.text);
            push(part?.content);
            push(part?.value);
        });
    }

    if (Array.isArray(response?.choices)) {
        response.choices.forEach((choice) => {
            push(choice?.message?.content);
            push(choice?.text);
        });
    }

    if (response && typeof response === 'object') {
        push(safeStringify(response));
    }

    return Array.from(new Set(candidates));
}

function isLikelyParsedEstimate(parsed) {
    if (!parsed || typeof parsed !== 'object') {
        return false;
    }

    const hasPositiveValue = typeof parsed.value === 'number' && parsed.value > 0;
    if (!hasPositiveValue) {
        return false;
    }

    const defaultReasoning = String(parsed.reasoning || '').trim().toLowerCase() === 'no reasoning provided';
    return !defaultReasoning || parsed.confidence !== 50;
}

function inferEuroEstimateFromText(text) {
    if (typeof text !== 'string' || !text.trim()) {
        return null;
    }

    const normalized = text.replace(/\u20ac/g, '€');
    const rangePattern = /(\d{1,3}(?:[\.\s]\d{3})*(?:,\d+)?|\d+(?:,\d+)?)\s*(?:-|–|to|bis)\s*(\d{1,3}(?:[\.\s]\d{3})*(?:,\d+)?|\d+(?:,\d+)?)\s*(?:€|eur)/i;
    const rangeMatch = normalized.match(rangePattern);
    if (rangeMatch) {
        const minValue = parseNumericEuro(rangeMatch[1]);
        const maxValue = parseNumericEuro(rangeMatch[2]);
        if (minValue && maxValue) {
            return {
                value: Math.round(((minValue + maxValue) / 2) * 100) / 100,
                reasoning: 'Estimated from Puter response range.',
                confidence: 45
            };
        }
    }

    const euroAfterPattern = /(\d{1,3}(?:[\.\s]\d{3})*(?:,\d+)?|\d+(?:,\d+)?)\s*(?:€|eur)\b/i;
    const euroBeforePattern = /(?:€|eur)\s*(\d{1,3}(?:[\.\s]\d{3})*(?:,\d+)?|\d+(?:,\d+)?)/i;
    const afterMatch = normalized.match(euroAfterPattern);
    const beforeMatch = normalized.match(euroBeforePattern);
    const raw = (afterMatch && afterMatch[1]) || (beforeMatch && beforeMatch[1]);
    const value = parseNumericEuro(raw);
    if (!value || value <= 0) {
        return null;
    }

    return {
        value,
        reasoning: 'Estimated from Puter response text.',
        confidence: 40
    };
}

function normalizeContent(content) {
    if (typeof content === 'string') {
        return content;
    }

    if (Array.isArray(content)) {
        return content
            .map((part) => {
                if (typeof part === 'string') {
                    return part;
                }
                if (part?.text) {
                    return part.text;
                }
                return '';
            })
            .filter(Boolean)
            .join('\n');
    }

    return String(content || '');
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

module.exports = PuterEstimator;
