/**
 * Content script for Kleinanzeigen AI Analyzer
 * Orchestrates DOM hooks and delegates heavy logic to modular helpers.
 */

const {
    registerOutsideClickHandler,
    showExistingEstimation,
    injectAIEstimate
} = require('./content/estimate-ui');
const { extractItemData } = require('./content/data-extractor');
const { createInjectAIAnalysisButton } = require('./content/analyze-button');

let analyzer = null;

registerOutsideClickHandler();

const injectAIAnalysisButton = createInjectAIAnalysisButton({
    ensureAnalyzerReady,
    storageManager: window.StorageManager,
    showExistingEstimation,
    injectAIEstimate,
    extractItemData
});

async function initializeAnalyzer() {
    try {
        await ensureAnalyzerReady();
    } catch (error) {
        if (
            error.code === 'missing-api-key' ||
            error.code === 'extension-invalidated' ||
            error.message?.includes('Extension context invalidated')
        ) {
            return;
        }

        console.error('Failed to initialize AI analyzer:', error);
    }
}

async function ensureAnalyzerReady() {
    if (analyzer) {
        return analyzer;
    }

    let apiKey;
    try {
        apiKey = await window.StorageManager.getApiKey();
    } catch (error) {
        const err = new Error(error.message || 'Failed to read API key from extension storage.');
        err.code = error.message?.includes('Extension context invalidated')
            ? 'extension-invalidated'
            : 'storage-error';
        throw err;
    }

    if (!apiKey) {
        const err = new Error('API key not configured');
        err.code = 'missing-api-key';
        throw err;
    }

    try {
        analyzer = await window.getEstimator();
        return analyzer;
    } catch (error) {
        const err = new Error(error.message || 'Failed to initialize AI analyzer.');
        err.code = 'estimator-init-failed';
        throw err;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initializeAnalyzer();
    injectAIAnalysisButton();
});

if (document.readyState !== 'loading') {
    initializeAnalyzer();
    injectAIAnalysisButton();
}

const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
        if (mutation.type === 'childList') {
            injectAIAnalysisButton();
        }
    }
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});
