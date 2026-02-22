const { PROVIDERS, getProviderMeta } = require('./lib/providers/metadata');

const AUTO_SAVE_DEBOUNCE_MS = 800;

document.addEventListener('DOMContentLoaded', () => {
    const elements = cacheElements();
    const state = createInitialState();

    renderProviderCards(elements, state);
    selectProvider(state.selectedProvider, state, elements, { userInitiated: false });
    bindEvents(elements, state);
    loadSettings(elements, state);
});

function cacheElements() {
    return {
        providerGrid: document.getElementById('provider-grid'),
        apiKeyInput: document.getElementById('api-key'),
        apiHelper: document.getElementById('api-helper'),
        modelSelect: document.getElementById('model-select'),
        maxImagesInput: document.getElementById('max-images'),
        maxImagesField: document.getElementById('max-images-field'),
        temperatureInput: document.getElementById('temperature'),
        enableImagesToggle: document.getElementById('enable-images'),
        testButton: document.getElementById('test'),
        status: document.getElementById('status')
    };
}

function createInitialState() {
    return {
        selectedProvider: 'gemini',
        providerApiKeys: {},
        providerModelSelections: {},
        providerModels: {},
        maxImages: 4,
        temperature: 0,
        randomSeed: 1337,
        enableImages: true,
        autoSaveTimer: null,
        modelRefreshTimer: null,
        isHydrating: true,
        lastAutoSaveNotice: 0,
        lastFetchedApiKeys: {}
    };
}

function renderProviderCards(elements, state) {
    const container = elements.providerGrid;
    container.innerHTML = '';
    PROVIDERS.forEach((provider) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'provider-card';
        card.dataset.provider = provider.id;
        card.innerHTML = `
            <strong>${provider.icon} ${provider.name}</strong>
            <span>${provider.tagline}</span>
        `;
        card.addEventListener('click', () =>
            selectProvider(provider.id, state, elements, { userInitiated: true })
        );
        container.appendChild(card);
    });
}

function bindEvents(elements, state) {
    elements.modelSelect.addEventListener('change', () => {
        state.providerModelSelections[state.selectedProvider] = elements.modelSelect.value;
        maybeScheduleAutoSave(state, elements);
    });

    elements.apiKeyInput.addEventListener('input', () => {
        const provider = getProviderMeta(state.selectedProvider);
        if (!providerRequiresApiKey(provider)) {
            return;
        }
        const trimmedKey = elements.apiKeyInput.value.trim();
        state.providerApiKeys[state.selectedProvider] = trimmedKey;
        if (!trimmedKey) {
            delete state.lastFetchedApiKeys[state.selectedProvider];
            clearModelRefreshTimer(state);
        } else {
            scheduleModelAutoRefresh(state, elements);
        }
        maybeScheduleAutoSave(state, elements);
    });

    elements.testButton.addEventListener('click', async () => {
        await withBusyButton(elements.testButton, async () => testApiKey(state, elements));
    });

    elements.maxImagesInput.addEventListener('change', () => {
        state.maxImages = Number(elements.maxImagesInput.value);
        maybeScheduleAutoSave(state, elements);
    });

    elements.temperatureInput.addEventListener('input', () => {
        state.temperature = Number(elements.temperatureInput.value);
        maybeScheduleAutoSave(state, elements);
    });

    elements.enableImagesToggle.addEventListener('change', () => {
        state.enableImages = elements.enableImagesToggle.checked;
        syncImageFieldVisibility(state, elements);
        maybeScheduleAutoSave(state, elements);
    });
}

function loadSettings(elements, state) {
    const keys = [
        'aiProvider',
        'providerApiKeys',
        'providerModelSelections',
        'modelCatalog',
        'modelCatalogUpdatedAt',
        'geminiApiKey',
        'modelName',
        'maxImages',
        'enableImages',
        'temperature',
        'randomSeed'
    ];

    chrome.storage.local.get(keys, (result) => {
        if (chrome.runtime.lastError) {
            showStatus(elements.status, chrome.runtime.lastError.message, 'error');
            state.isHydrating = false;
            return;
        }

        state.selectedProvider = result.aiProvider || 'gemini';
        state.providerApiKeys = {
            ...(result.providerApiKeys || {})
        };
        if (result.geminiApiKey && !state.providerApiKeys.gemini) {
            state.providerApiKeys.gemini = result.geminiApiKey;
        }

        state.providerModelSelections = {
            ...(result.providerModelSelections || {})
        };
        if (result.modelName && !state.providerModelSelections.gemini) {
            state.providerModelSelections.gemini = result.modelName;
        }

        state.providerModels = result.modelCatalog || {};

        state.maxImages = result.maxImages || state.maxImages;
        state.enableImages = result.enableImages !== false;
        state.temperature =
            typeof result.temperature === 'number' ? result.temperature : state.temperature;
        state.randomSeed = Number.isInteger(result.randomSeed)
            ? result.randomSeed
            : state.randomSeed;

        hydrateForm(elements, state);
        state.isHydrating = false;
    });
}

function hydrateForm(elements, state) {
    updateActiveProviderCard(state);
    updateApiKeyUI(elements, state);
    populateModelSelect(elements, state);

    elements.maxImagesInput.value = state.maxImages;
    elements.temperatureInput.value = state.temperature;
    elements.enableImagesToggle.checked = state.enableImages;
    syncImageFieldVisibility(state, elements);
}

function syncImageFieldVisibility(state, elements) {
    const showImages = Boolean(state.enableImages);
    if (elements.maxImagesField) {
        elements.maxImagesField.classList.toggle('hidden', !showImages);
    }
    elements.maxImagesInput.disabled = !showImages;
}

function updateActiveProviderCard(state) {
    document.querySelectorAll('.provider-card').forEach((card) => {
        card.classList.toggle('active', card.dataset.provider === state.selectedProvider);
    });
}

function selectProvider(providerId, state, elements, { userInitiated = false } = {}) {
    const previousProvider = state.selectedProvider;
    state.selectedProvider = providerId;
    updateActiveProviderCard(state);
    updateApiKeyUI(elements, state);
    populateModelSelect(elements, state);
    if (userInitiated && previousProvider !== providerId) {
        maybeScheduleAutoSave(state, elements);
    }
}

function updateApiKeyUI(elements, state) {
    const provider = getProviderMeta(state.selectedProvider);
    const requiresApiKey = providerRequiresApiKey(provider);

    elements.apiKeyInput.disabled = !requiresApiKey;
    elements.apiKeyInput.value = requiresApiKey
        ? state.providerApiKeys[state.selectedProvider] || ''
        : '';
    elements.apiKeyInput.placeholder = requiresApiKey
        ? `e.g., ${provider.placeholderKey}`
        : provider.placeholderKey || 'No API key required';

    elements.testButton.textContent = requiresApiKey ? 'Test Key' : 'Test Connection';

    if (requiresApiKey) {
        elements.apiHelper.innerHTML = `Get a ${provider.shortName} key at <a href="${provider.docsUrl}" target="_blank">${provider.docsUrl}</a>`;
    } else {
        elements.apiHelper.innerHTML = `${provider.shortName} uses account sign-in instead of API keys. Learn more at <a href="${provider.docsUrl}" target="_blank">${provider.docsUrl}</a>`;
    }
}

function populateModelSelect(elements, state) {
    const provider = getProviderMeta(state.selectedProvider);
    const models =
        (state.providerModels[state.selectedProvider] &&
        state.providerModels[state.selectedProvider].length
            ? state.providerModels[state.selectedProvider]
            : provider.suggestedModels) || [];
    const currentSelection =
        state.providerModelSelections[state.selectedProvider] || provider.defaultModel;

    elements.modelSelect.innerHTML = '';

    const seen = new Set();
    const recommendedModel = getRecommendedModelOption(provider, models);

    if (recommendedModel) {
        appendOption(elements.modelSelect, recommendedModel, seen, { recommended: true });
    }

    models.forEach((model) => {
        appendOption(elements.modelSelect, model, seen);
    });

    const optionValues = Array.from(elements.modelSelect.options).map((option) => option.value);
    if (optionValues.includes(currentSelection)) {
        elements.modelSelect.value = currentSelection;
    } else if (optionValues.includes(provider.defaultModel)) {
        elements.modelSelect.value = provider.defaultModel;
    } else if (elements.modelSelect.options.length) {
        elements.modelSelect.selectedIndex = 0;
    }

    state.providerModelSelections[state.selectedProvider] = elements.modelSelect.value;
}

async function refreshModels(state, elements, silent, providerIdOverride = null) {
    const providerId = providerIdOverride || state.selectedProvider;
    const provider = getProviderMeta(providerId);
    const requiresApiKey = providerRequiresApiKey(provider);
    const apiKey = (state.providerApiKeys[providerId] || '').trim();
    if (requiresApiKey && !apiKey) {
        if (!silent && providerId === state.selectedProvider) {
            showStatus(elements.status, `Enter your ${provider.shortName} API key first.`, 'error');
        }
        return null;
    }

    if (!silent && providerId === state.selectedProvider) {
        showStatus(elements.status, `Fetching ${provider.shortName} models...`, 'info');
    }

    try {
        const models = await provider.fetchModels(apiKey);
        state.providerModels[providerId] = models;
        chrome.storage.local.set({
            modelCatalog: state.providerModels,
            modelCatalogUpdatedAt: Date.now()
        });
        if (providerId === state.selectedProvider) {
            populateModelSelect(elements, state);
        }
        if (!silent && providerId === state.selectedProvider) {
            showStatus(
                elements.status,
                `Loaded ${models.length} models from ${provider.shortName}`,
                'success'
            );
        }
        return models;
    } catch (error) {
        if (providerId === state.selectedProvider) {
            showStatus(elements.status, error.message || 'Failed to fetch models', 'error');
        } else {
            console.warn(`Failed to fetch models for ${provider.shortName}:`, error);
        }
        return null;
    }
}

async function testApiKey(state, elements) {
    const provider = getProviderMeta(state.selectedProvider);
    const requiresApiKey = providerRequiresApiKey(provider);
    const apiKey = (state.providerApiKeys[state.selectedProvider] || '').trim();
    if (requiresApiKey && !apiKey) {
        showStatus(elements.status, `Enter your ${provider.shortName} API key first.`, 'error');
        return false;
    }

    showStatus(
        elements.status,
        requiresApiKey
            ? `Testing ${provider.shortName} key...`
            : `Testing ${provider.shortName} connection...`,
        'info'
    );

    try {
        const models = await provider.fetchModels(apiKey);
        showStatus(
            elements.status,
            `${requiresApiKey ? 'API key validated' : 'Connection validated'}. ${models.length} models accessible for ${provider.shortName}.`,
            'success'
        );
        elements.testButton.textContent = requiresApiKey
            ? 'Key Validated ✓'
            : 'Connection Validated ✓';
        elements.testButton.classList.add('validated');
        setTimeout(() => {
            elements.testButton.textContent = providerRequiresApiKey(provider)
                ? 'Test Key'
                : 'Test Connection';
            elements.testButton.classList.remove('validated');
        }, 3000);
        return true;
    } catch (error) {
        showStatus(
            elements.status,
            error.message || `Failed to validate ${provider.shortName} key.`,
            'error'
        );
        return false;
    }
}

function saveSettings(state, elements, { silent = true, requireApiKey = false } = {}) {
    const payload = buildPayload(state, elements, { requireApiKey });
    if (!payload) {
        return;
    }

    if (!silent) {
        showStatus(elements.status, 'Saving settings...', 'info');
    }

    chrome.storage.local.set(payload, () => {
        if (chrome.runtime.lastError) {
            if (!silent) {
                showStatus(elements.status, chrome.runtime.lastError.message, 'error');
            } else {
                console.warn('Auto-save failed:', chrome.runtime.lastError.message);
            }
            return;
        }
        if (window.globalEstimator) {
            window.globalEstimator = null;
        }
        if (silent) {
            indicateAutoSaved(state, elements);
        } else {
            showStatus(elements.status, 'Settings saved. Ready for your next listing!', 'success');
        }
    });
}

function scheduleAutoSave(state, elements) {
    if (state.autoSaveTimer) {
        clearTimeout(state.autoSaveTimer);
    }
    state.autoSaveTimer = setTimeout(() => {
        saveSettings(state, elements, { silent: true, requireApiKey: false });
    }, AUTO_SAVE_DEBOUNCE_MS);
}

function maybeScheduleAutoSave(state, elements) {
    if (state.isHydrating) {
        return;
    }
    scheduleAutoSave(state, elements);
}

function scheduleModelAutoRefresh(state, elements) {
    if (state.isHydrating) {
        return;
    }

    const providerId = state.selectedProvider;
    const provider = getProviderMeta(providerId);
    if (!providerRequiresApiKey(provider)) {
        return;
    }
    const apiKey = (state.providerApiKeys[providerId] || '').trim();
    if (!apiKey) {
        return;
    }

    clearModelRefreshTimer(state);

    state.modelRefreshTimer = setTimeout(() => {
        state.modelRefreshTimer = null;
        autoRefreshModelsForProvider(providerId, apiKey, state, elements);
    }, AUTO_SAVE_DEBOUNCE_MS);
}

function clearModelRefreshTimer(state) {
    if (state.modelRefreshTimer) {
        clearTimeout(state.modelRefreshTimer);
        state.modelRefreshTimer = null;
    }
}

async function autoRefreshModelsForProvider(providerId, apiKey, state, elements) {
    if (state.lastFetchedApiKeys[providerId] === apiKey) {
        return;
    }

    try {
        const models = await refreshModels(state, elements, false, providerId);
        if (models) {
            state.lastFetchedApiKeys[providerId] = apiKey;
        }
    } catch (error) {
        console.warn(`Auto refresh failed for ${providerId}:`, error);
    }
}

function indicateAutoSaved(state, elements) {
    const now = Date.now();
    if (now - state.lastAutoSaveNotice < 1500) {
        return;
    }
    state.lastAutoSaveNotice = now;
    showStatus(elements.status, 'Settings auto-saved', 'success');
}

function buildPayload(state, elements, { requireApiKey = true } = {}) {
    const provider = getProviderMeta(state.selectedProvider);
    const requiresApiKey = providerRequiresApiKey(provider);
    const apiKey = (state.providerApiKeys[state.selectedProvider] || '').trim();
    if (requireApiKey && requiresApiKey && !apiKey) {
        showStatus(
            elements.status,
            `Add your ${provider.shortName} API key before saving.`,
            'error'
        );
        return null;
    }

    const maxImages = Number(elements.maxImagesInput.value);
    if (Number.isNaN(maxImages) || maxImages < 1 || maxImages > 10) {
        showStatus(elements.status, 'Max images must be between 1 and 10.', 'error');
        return null;
    }

    const temperature = Number(elements.temperatureInput.value);
    if (Number.isNaN(temperature) || temperature < 0 || temperature > 2) {
        showStatus(elements.status, 'Temperature must be between 0 and 2.', 'error');
        return null;
    }

    state.maxImages = maxImages;
    state.temperature = temperature;
    state.enableImages = elements.enableImagesToggle.checked;

    const payload = {
        aiProvider: state.selectedProvider,
        providerApiKeys: state.providerApiKeys,
        providerModelSelections: state.providerModelSelections,
        modelCatalog: state.providerModels,
        modelCatalogUpdatedAt: Date.now(),
        geminiApiKey: state.providerApiKeys.gemini,
        modelName: state.providerModelSelections[state.selectedProvider],
        maxImages: state.maxImages,
        enableImages: state.enableImages,
        temperature: state.temperature,
        randomSeed: state.randomSeed
    };

    return payload;
}

function showStatus(statusEl, message, type) {
    statusEl.textContent = message;
    statusEl.className = `status-card ${type}`;
    statusEl.hidden = false;

    if (type === 'success') {
        setTimeout(() => {
            statusEl.hidden = true;
        }, 2600);
    }
}

async function withBusyButton(button, fn) {
    button.disabled = true;
    try {
        await fn();
    } catch (error) {
        console.warn('Settings action failed:', error);
    } finally {
        button.disabled = false;
    }
}

function appendOption(selectEl, model, seen, { recommended = false } = {}) {
    if (!model?.id || seen.has(model.id)) {
        return;
    }

    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = recommended ? `★ Recommended • ${model.label}` : model.label;

    if (recommended) {
        option.dataset.recommended = 'true';
    }

    selectEl.appendChild(option);
    seen.add(model.id);
}

function getRecommendedModelOption(provider, models) {
    if (!provider.defaultModel) {
        return null;
    }

    const combined = [...models, ...(provider.suggestedModels || [])];
    const match = combined.find((model) => model.id === provider.defaultModel);

    if (!match) {
        return {
            id: provider.defaultModel,
            label: formatModelLabel(provider.defaultModel)
        };
    }

    return {
        id: provider.defaultModel,
        label: match.label
    };
}

function formatModelLabel(id) {
    return id
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase())
        .trim();
}

function providerRequiresApiKey(provider) {
    return provider?.requiresApiKey !== false;
}
