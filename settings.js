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
        refreshButton: document.getElementById('refresh-models'),
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
        isHydrating: true,
        lastAutoSaveNotice: 0
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
        state.providerApiKeys[state.selectedProvider] = elements.apiKeyInput.value.trim();
        maybeScheduleAutoSave(state, elements);
    });

    elements.refreshButton.addEventListener('click', async () => {
        await withBusyButton(elements.refreshButton, () => refreshModels(state, elements, false));
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
    elements.apiKeyInput.value = state.providerApiKeys[state.selectedProvider] || '';
    elements.apiKeyInput.placeholder = `e.g., ${provider.placeholderKey}`;
    elements.apiHelper.innerHTML = `Get a ${provider.shortName} key at <a href="${provider.docsUrl}" target="_blank">${provider.docsUrl}</a>`;
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

async function refreshModels(state, elements, silent) {
    const provider = getProviderMeta(state.selectedProvider);
    const apiKey = (state.providerApiKeys[state.selectedProvider] || '').trim();
    if (!apiKey) {
        showStatus(elements.status, `Enter your ${provider.shortName} API key first.`, 'error');
        return null;
    }

    if (!silent) {
        showStatus(elements.status, `Fetching ${provider.shortName} models...`, 'info');
    }

    try {
        const models = await provider.fetchModels(apiKey);
        state.providerModels[state.selectedProvider] = models;
        chrome.storage.local.set({
            modelCatalog: state.providerModels,
            modelCatalogUpdatedAt: Date.now()
        });
        populateModelSelect(elements, state);
        if (!silent) {
            showStatus(
                elements.status,
                `Loaded ${models.length} models from ${provider.shortName}`,
                'success'
            );
        }
        return models;
    } catch (error) {
        showStatus(elements.status, error.message || 'Failed to fetch models', 'error');
        return null;
    }
}

async function testApiKey(state, elements) {
    const provider = getProviderMeta(state.selectedProvider);
    const apiKey = (state.providerApiKeys[state.selectedProvider] || '').trim();
    if (!apiKey) {
        showStatus(elements.status, `Enter your ${provider.shortName} API key first.`, 'error');
        return false;
    }

    showStatus(elements.status, `Testing ${provider.shortName} key...`, 'info');

    try {
        const models = await provider.fetchModels(apiKey);
        showStatus(
            elements.status,
            `API key validated. ${models.length} models accessible for ${provider.shortName}.`,
            'success'
        );
        elements.testButton.textContent = 'Key Validated ✓';
        elements.testButton.classList.add('validated');
        setTimeout(() => {
            elements.testButton.textContent = 'Test Key';
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
    const apiKey = (state.providerApiKeys[state.selectedProvider] || '').trim();
    if (requireApiKey && !apiKey) {
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
