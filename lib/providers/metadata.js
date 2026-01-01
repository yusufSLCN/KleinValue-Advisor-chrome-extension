const PROVIDERS = [
    {
        id: 'gemini',
        name: 'Google Gemini',
        shortName: 'Gemini',
        accent: '#5c6ac4',
        gradient: 'linear-gradient(135deg, #7b5cff, #4e9af1)',
        icon: '🪐',
        tagline: 'Vision-first valuations via Google AI Studio.',
        docsUrl: 'https://aistudio.google.com/api-keys',
        defaultModel: 'gemini-2.5-flash',
        placeholderKey: 'AIzaSy...',
        supportsVision: true,
        suggestedModels: [
            { id: 'gemini-3-pro', label: 'Gemini 3 Pro (Flagship)' },
            { id: 'gemini-3-flash', label: 'Gemini 3 Flash' },
            { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
            { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
            { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' }
        ],
        fetchModels: fetchGeminiModels
    },
    {
        id: 'openai',
        name: 'OpenAI GPT',
        shortName: 'OpenAI',
        accent: '#0ea5e9',
        gradient: 'linear-gradient(135deg, #0ea5e9, #2563eb)',
        icon: '💠',
        tagline: 'GPT-4o family with rapid refresh cadence.',
        docsUrl: 'https://platform.openai.com/docs',
        defaultModel: 'gpt-4.1-mini',
        placeholderKey: 'sk-...',
        supportsVision: false,
        suggestedModels: [
            { id: 'gpt-4o', label: 'GPT-4o (Flagship)' },
            { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
            { id: 'gpt-4.1', label: 'GPT-4.1' },
            { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
            { id: 'gpt-4.1-nano', label: 'GPT-4.1 Nano' }
        ],
        fetchModels: fetchOpenAIModels
    },
    {
        id: 'anthropic',
        name: 'Anthropic Claude',
        shortName: 'Claude',
        accent: '#f97316',
        gradient: 'linear-gradient(135deg, #ff7a18, #ffb347)',
        icon: '🌤️',
        tagline: 'Claude 3.5 family tuned for reasoning.',
        docsUrl: 'https://docs.anthropic.com',
        defaultModel: 'claude-3-5-sonnet-20241022',
        placeholderKey: 'sk-ant-...',
        supportsVision: false,
        suggestedModels: [
            { id: 'claude-opus-4-5', label: 'Claude Opus 4.5' },
            { id: 'claude-3-7-sonnet-latest', label: 'Claude 3.7 Sonnet (Latest)' },
            { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
            { id: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku (Latest)' },
            { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' }
        ],
        fetchModels: fetchAnthropicModels
    }
];

const PROVIDER_MAP = PROVIDERS.reduce((acc, provider) => {
    acc[provider.id] = provider;
    return acc;
}, {});

function getProviderMeta(id) {
    return PROVIDER_MAP[id] || PROVIDER_MAP.gemini;
}

async function fetchGeminiModels(apiKey) {
    if (!apiKey) {
        throw new Error('Enter your Gemini API key first.');
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(endpoint);

    if (!response.ok) {
        const err = await safeJson(response);
        throw new Error(err?.error?.message || `Gemini API HTTP ${response.status}`);
    }

    const payload = await response.json();
    const models = Array.isArray(payload?.models) ? payload.models : [];
    console.info(`[Gemini] Raw model list (${models.length})`, models);
    const allowedFamilies = ['flash', 'pro'];
    const filteredModels = models
        .filter((model) => model.name?.startsWith('models/gemini'))
        .filter((model) => (model.supportedGenerationMethods || []).includes('generateContent'))
        .filter((model) => !isImageOnlyGeminiModel(model))
        .filter((model) => !isLegacyGeminiModel(model))
        .map((model) => ({
            ...model,
            cleanId: model.name.replace('models/', '')
        }))
        .filter((model) =>
            allowedFamilies.some((family) => model.cleanId.toLowerCase().includes(family))
        );

    const dedupedModels = dedupeGeminiModels(filteredModels);

    return dedupedModels
        .map((model) => {
            const cleanId = model.cleanId;
            return {
                id: cleanId,
                label: `${model.displayName || cleanId}${model.version ? ` (${model.version})` : ''}`.trim(),
                description: model.description || 'Multimodal generation'
            };
        })
        .sort((a, b) => a.label.localeCompare(b.label));
}

async function fetchOpenAIModels(apiKey) {
    if (!apiKey) {
        throw new Error('Enter your OpenAI API key first.');
    }

    const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
            Authorization: `Bearer ${apiKey}`
        }
    });

    if (!response.ok) {
        const err = await safeJson(response);
        throw new Error(err?.error?.message || `OpenAI API HTTP ${response.status}`);
    }

    const payload = await response.json();
    const models = Array.isArray(payload?.data) ? payload.data : [];
    const allowedPrefixes = ['gpt-4.1', 'gpt-4o', 'o4', 'o3'];
    const disallowedKeywords = ['image', 'vision', 'dall', 'tts', 'audio', 'whisper', 'embedding'];

    return models
        .filter((model) => allowedPrefixes.some((prefix) => model.id?.startsWith(prefix)))
        .filter((model) => !disallowedKeywords.some((keyword) => model.id?.includes(keyword)))
        .map((model) => ({
            id: model.id,
            label: prettifyModelId(model.id),
            description: model.owned_by ? `Owned by ${model.owned_by}` : 'OpenAI model'
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
}

async function fetchAnthropicModels(apiKey) {
    if (!apiKey) {
        throw new Error('Enter your Anthropic API key first.');
    }

    const response = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        }
    });

    if (!response.ok) {
        const err = await safeJson(response);
        throw new Error(err?.error?.message || `Anthropic API HTTP ${response.status}`);
    }

    const payload = await response.json();
    const models = Array.isArray(payload?.data) ? payload.data : [];

    return models
        .filter((model) => model.id?.startsWith('claude'))
        .filter((model) => !/claude-(1|2)/.test(model.id))
        .map((model) => ({
            id: model.id,
            label: prettifyModelId(model.id),
            description: model.display_name || 'Anthropic model'
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
}

function prettifyModelId(id) {
    return id
        .replace(/-/g, ' ')
        .replace(
            /\b(gpt|claude|sonnet|opus|haiku|mini|flash|pro)\b/gi,
            (match) => match[0].toUpperCase() + match.slice(1)
        )
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^Gpt/i, 'GPT')
        .replace(/^Claude/i, 'Claude');
}

async function safeJson(response) {
    try {
        return await response.json();
    } catch (error) {
        return null;
    }
}

function isImageOnlyGeminiModel(model) {
    const cleanId = (model.name || '').replace('models/', '').toLowerCase();
    const keywords = ['imagen', 'image', 'img', 'photo'];
    if (keywords.some((keyword) => cleanId.includes(keyword))) {
        return true;
    }
    return (model.supportedGenerationMethods || []).some((method) =>
        method.toLowerCase().includes('image')
    );
}

function isLegacyGeminiModel(model) {
    const cleanId = (model.name || '').replace('models/', '').toLowerCase();
    const legacyIdentifiers = [
        'gemini-pro',
        'gemini-pro-vision',
        'gemini-ultra',
        'gemini-ultra-vision',
        'gemini-nano'
    ];

    if (legacyIdentifiers.some((identifier) => cleanId.startsWith(identifier))) {
        return true;
    }

    const versionMatch = cleanId.match(/gemini-([0-9]+(?:\.[0-9]+)?)/);
    if (versionMatch) {
        const version = parseFloat(versionMatch[1]);
        if (!Number.isNaN(version) && version < 1.5) {
            return true;
        }
    }

    return /(001|002|003)(?!\d)/.test(cleanId);
}

function dedupeGeminiModels(models) {
    const map = new Map();
    models.forEach((model) => {
        const key = normalizeGeminiModelKey(model);
        const existing = map.get(key);
        if (!existing || getGeminiModelPriority(model.cleanId) > getGeminiModelPriority(existing.cleanId)) {
            map.set(key, model);
        }
    });
    return Array.from(map.values());
}

function normalizeGeminiModelKey(model) {
    const base = (model.displayName || model.cleanId || '')
           .toLowerCase()
           .replace(/\b(latest|preview|experimental|exp|native audio|image|tts)\b.*$/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    if (base) {
        return base;
    }
    const cleaned = (model.cleanId || '').toLowerCase().replace(/-(preview|exp|experimental).*/g, '');
    return cleaned || model.cleanId || 'unknown';
}

function getGeminiModelPriority(cleanId = '') {
    const value = cleanId.toLowerCase();
    if (value.includes('latest')) {
        return 3;
    }
    if (value.includes('preview') || value.includes('exp')) {
        return 1;
    }
    return 2;
}

module.exports = {
    PROVIDERS,
    PROVIDER_MAP,
    getProviderMeta
};
