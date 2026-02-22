const {
    buildEstimationPrompt,
    parseEstimatorResponse,
    parseNumericEuro
} = require('./estimation-core');

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
            max_tokens: 1400,
            verbosity: 'medium',
            reasoning_effort: 'medium',
            response: {
                format: {
                    type: 'json_object'
                }
            }
        };

        try {
            await ensurePuterAuthenticated(puter);
            let response = await invokePuterChat(puter, prompt, images, options);

            if (isPuterAuthError(response)) {
                await ensurePuterAuthenticated(puter, { forceSignIn: true });
                response = await invokePuterChat(puter, prompt, images, options);
            }

            if (isPuterAuthError(response)) {
                throw normalizePuterError(response);
            }

            const result = await parsePuterEstimation(response, {
                puter,
                prompt,
                images,
                options,
                itemData
            });
            result.model = this.modelName;
            result.provider = 'puter';
            result.providerName = 'Puter.js';
            result.estimatedCost = this.estimateCost(response);
            return result;
        } catch (error) {
            if (isPuterAuthError(error)) {
                try {
                    await ensurePuterAuthenticated(puter, { forceSignIn: true });
                    const retryResponse = await invokePuterChat(puter, prompt, images, options);

                    if (isPuterAuthError(retryResponse)) {
                        throw normalizePuterError(retryResponse);
                    }

                    const retryResult = await parsePuterEstimation(retryResponse, {
                        puter,
                        prompt,
                        images,
                        options,
                        itemData
                    });
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

async function ensurePuterAuthenticated(puter, { forceSignIn = false } = {}) {
    if (!puter) {
        throw new Error('Puter client is unavailable.');
    }

    if (!forceSignIn && !(await needsPuterSignIn(puter))) {
        return;
    }

    await ensurePuterSignedIn(puter);

    if (await needsPuterSignIn(puter)) {
        throw new Error('Puter authentication did not complete. Please try signing in again.');
    }
}

async function needsPuterSignIn(puter) {
    if (!puter?.auth) {
        return false;
    }

    try {
        if (typeof puter.auth.whoami === 'function') {
            const whoami = await puter.auth.whoami();
            if (whoami && !whoami.error && (whoami.username || whoami.uid || whoami.id)) {
                return false;
            }
            return isPuterAuthError(whoami);
        }

        if (typeof puter.auth.getUser === 'function') {
            const user = await puter.auth.getUser();
            if (user && !user.error) {
                return false;
            }
            return true;
        }

        if (typeof puter.auth.isSignedIn === 'function') {
            return !puter.auth.isSignedIn();
        }

        return !puter.authToken;
    } catch (error) {
        return isPuterAuthError(error);
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
        const authResult = await puter.auth.signIn();
        const token = authResult?.token || authResult?.authToken;
        if (token && typeof puter.setAuthToken === 'function') {
            puter.setAuthToken(token);
        }
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
        text.includes('token_auth_failed') ||
        text.includes('auth token') ||
        text.includes('/whoami') ||
        text.includes('sign in') ||
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

async function parsePuterEstimation(response, context = {}) {
    const candidates = collectPuterTextCandidates(response);
    const usageValues = collectLikelyTokenCounts(response);

    for (const candidate of candidates) {
        if (!candidate || typeof candidate !== 'string') {
            continue;
        }

        const parsed = parseEstimatorResponse(candidate);
        if (isLikelyParsedEstimate(parsed, candidate, usageValues)) {
            return parsed;
        }
    }

    for (const candidate of candidates) {
        const inferred = inferEuroEstimateFromText(candidate);
        if (inferred) {
            return inferred;
        }
    }

    if (context?.puter && context?.prompt) {
        const retry = await retryWithStrictJsonPrompt(context);
        if (retry) {
            return retry;
        }
    }

    if (context?.puter && context?.itemData) {
        const compactRetry = await retryWithCompactJsonPrompt(context);
        if (compactRetry) {
            return compactRetry;
        }

        if (isTruncatedEmptyPuterResponse(response)) {
            const truncatedRetry = await retryAfterTruncatedEmpty(context);
            if (truncatedRetry) {
                return truncatedRetry;
            }
        }
    }

    const finalParsed = parseEstimatorResponse(extractTextFromPuterResponse(response));
    if (isDefaultEmptyEstimate(finalParsed)) {
        logPuterUnparsableResponse(response, candidates, context);
        throw new Error('Puter returned an unparsable response. Please retry analysis.');
    }
    return finalParsed;
}

function logPuterUnparsableResponse(response, candidates, context = {}) {
    try {
        const promptPreview = String(context?.prompt || '').slice(0, 500);
        const normalizedCandidates = Array.isArray(candidates)
            ? candidates.map((candidate, index) => ({
                  index,
                  length: String(candidate || '').length,
                  preview: String(candidate || '').slice(0, 1200)
              }))
            : [];

        console.error('Puter unparsable output debug', {
            model: context?.options?.model,
            maxTokens: context?.options?.max_tokens,
            temperature: context?.options?.temperature,
            promptPreview,
            rawResponse: response,
            rawResponseSerialized: safeStringify(response),
            extractedCandidates: normalizedCandidates,
            usageValues: Array.from(collectLikelyTokenCounts(response || {}))
        });
    } catch (error) {
        console.error('Failed to print Puter debug output:', error);
    }
}

async function retryWithStrictJsonPrompt({ puter, prompt, images, options }) {
    const strictPrompt = `${prompt}\n\nReturn ONLY minified JSON with exact keys {\"value\":number,\"reasoning\":string,\"confidence\":number}. No markdown, no prose, no arrays, no extra fields.`;
    const retryOptions = buildPuterRetryOptions(options, {
        max_tokens: Math.min(Math.max(options?.max_tokens || 1200, 500), 1800)
    });

    try {
        const retryResponse = await invokePuterChat(puter, strictPrompt, images || [], retryOptions);
        if (isPuterAuthError(retryResponse)) {
            return null;
        }

        const retryCandidates = collectPuterTextCandidates(retryResponse);
        const usageValues = collectLikelyTokenCounts(retryResponse);
        for (const candidate of retryCandidates) {
            const parsed = parseEstimatorResponse(candidate);
            if (isLikelyParsedEstimate(parsed, candidate, usageValues)) {
                return parsed;
            }
        }

        for (const candidate of retryCandidates) {
            const inferred = inferEuroEstimateFromText(candidate);
            if (inferred) {
                return inferred;
            }
        }
    } catch (_error) {
    }

    return null;
}

async function retryWithCompactJsonPrompt({ puter, itemData, options }) {
    const compactPrompt = buildCompactPuterPrompt(itemData);
    const retryOptions = buildPuterRetryOptions(options, {
        max_tokens: 700
    });

    try {
        const retryResponse = await invokePuterChat(puter, compactPrompt, [], retryOptions);
        if (isPuterAuthError(retryResponse)) {
            return null;
        }

        const candidates = collectPuterTextCandidates(retryResponse);
        const usageValues = collectLikelyTokenCounts(retryResponse);

        for (const candidate of candidates) {
            const parsed = parseEstimatorResponse(candidate);
            if (isLikelyParsedEstimate(parsed, candidate, usageValues)) {
                return parsed;
            }
        }

        for (const candidate of candidates) {
            const inferred = inferEuroEstimateFromText(candidate);
            if (inferred) {
                return inferred;
            }
        }
    } catch (_error) {
    }

    return null;
}

async function retryAfterTruncatedEmpty({ puter, itemData, options }) {
    const prompt = buildUltraCompactPuterPrompt(itemData);
    const retryOptions = buildPuterRetryOptions(options, {
        max_tokens: 220,
        verbosity: 'low'
    });

    try {
        const retryResponse = await invokePuterChat(puter, prompt, [], retryOptions);
        if (isPuterAuthError(retryResponse)) {
            return null;
        }

        const candidates = collectPuterTextCandidates(retryResponse);
        const usageValues = collectLikelyTokenCounts(retryResponse);

        for (const candidate of candidates) {
            const parsed = parseEstimatorResponse(candidate);
            if (isLikelyParsedEstimate(parsed, candidate, usageValues)) {
                return parsed;
            }
        }

        for (const candidate of candidates) {
            const inferred = inferEuroEstimateFromText(candidate);
            if (inferred) {
                return inferred;
            }
        }

        const fallbackModelOptions = buildPuterRetryOptions(options, {
            model: 'gpt-4.1-mini',
            max_tokens: 220,
            verbosity: 'low'
        });

        const fallbackResponse = await invokePuterChat(puter, prompt, [], fallbackModelOptions);
        if (!isPuterAuthError(fallbackResponse)) {
            const fallbackCandidates = collectPuterTextCandidates(fallbackResponse);
            const fallbackUsageValues = collectLikelyTokenCounts(fallbackResponse);

            for (const candidate of fallbackCandidates) {
                const parsed = parseEstimatorResponse(candidate);
                if (isLikelyParsedEstimate(parsed, candidate, fallbackUsageValues)) {
                    return parsed;
                }
            }

            for (const candidate of fallbackCandidates) {
                const inferred = inferEuroEstimateFromText(candidate);
                if (inferred) {
                    return inferred;
                }
            }
        }
    } catch (_error) {
    }

    return null;
}

function buildCompactPuterPrompt(itemData = {}) {
    const basePrompt = buildEstimationPrompt(itemData, false);
    return [
        basePrompt,
        'Extra requirement: keep reasoning descriptive but concise (2-4 sentences) about condition, market, and price fit.',
        'Return ONLY minified JSON with exact keys {"value":number,"reasoning":string,"confidence":number}. No extra keys.'
    ].join('\n\n');
}

function buildUltraCompactPuterPrompt(itemData = {}) {
    const title = String(itemData?.title || '').trim().slice(0, 120) || 'Unknown';
    const location = String(itemData?.location || 'Unknown').trim().slice(0, 80);

    return [
        'Output ONLY JSON: {"value":number,"reasoning":string,"confidence":number}',
        'Reasoning must be <= 120 characters.',
        `Title: ${title}`,
        `Location: ${location}`
    ].join('\n');
}

function buildPuterRetryOptions(baseOptions = {}, overrides = {}) {
    const model = overrides.model || baseOptions.model || 'gpt-5-nano';
    return {
        model,
        max_tokens: overrides.max_tokens,
        temperature:
            overrides.temperature !== undefined
                ? overrides.temperature
                : baseOptions.temperature,
        verbosity: overrides.verbosity || 'medium',
        reasoning_effort: overrides.reasoning_effort || 'medium'
    };
}

function isTruncatedEmptyPuterResponse(response) {
    const finishReason = String(response?.finish_reason || response?.result?.finish_reason || '').toLowerCase();
    if (finishReason !== 'length') {
        return false;
    }

    const content = response?.message?.content;
    if (typeof content === 'string') {
        return content.trim().length === 0;
    }

    if (Array.isArray(content)) {
        const merged = content
            .map((part) => (typeof part === 'string' ? part : part?.text || ''))
            .join('')
            .trim();
        return merged.length === 0;
    }

    return !content;
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

function isLikelyParsedEstimate(parsed, sourceText = '', usageValues = new Set()) {
    if (!parsed || typeof parsed !== 'object') {
        return false;
    }

    const hasPositiveValue = typeof parsed.value === 'number' && parsed.value > 0;
    if (!hasPositiveValue) {
        return false;
    }

    if (usageValues.has(Math.round(parsed.value))) {
        return false;
    }

    const source = String(sourceText || '').toLowerCase();
    if (
        source.includes('"prompt_tokens"') ||
        source.includes('"completion_tokens"') ||
        source.includes('"finish_reason"') ||
        source.includes('"via_ai_chat_service"') ||
        source.includes('"index"')
    ) {
        return false;
    }

    const defaultReasoning = String(parsed.reasoning || '').trim().toLowerCase() === 'no reasoning provided';
    return !defaultReasoning || parsed.confidence !== 50;
}

function isDefaultEmptyEstimate(parsed) {
    if (!parsed || typeof parsed !== 'object') {
        return true;
    }
    const value = Number(parsed.value);
    const confidence = Number(parsed.confidence);
    const reasoning = String(parsed.reasoning || '').trim().toLowerCase();
    return value === 0 && confidence === 50 && reasoning === 'no reasoning provided';
}

function collectLikelyTokenCounts(response) {
    const values = new Set();
    const add = (v) => {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) {
            values.add(Math.round(n));
        }
    };

    const usageCandidates = [
        response?.usage,
        response?.message?.usage,
        response?.result?.usage,
        response?.metadata?.usage,
        response?.choices?.[0]?.usage,
        response?.error?.usage
    ];

    usageCandidates.forEach((usage) => {
        if (!usage || typeof usage !== 'object') {
            return;
        }
        add(usage.prompt_tokens || usage.input_tokens || usage.promptTokenCount);
        add(usage.completion_tokens || usage.output_tokens || usage.candidatesTokenCount);
        add(usage.total_tokens || usage.totalTokenCount);
    });

    return values;
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
