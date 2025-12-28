function createInjectAIAnalysisButton({
    ensureAnalyzerReady,
    storageManager,
    showExistingEstimation,
    injectAIEstimate,
    extractItemData
}) {
    if (!ensureAnalyzerReady) {
        throw new Error('ensureAnalyzerReady dependency is required');
    }

    if (!storageManager) {
        console.warn('StorageManager dependency missing; Analyze button cannot function.');
    }

    return function injectAIAnalysisButton() {
        if (!storageManager) {
            return;
        }

        if (document.getElementById('ai-analyze-button')) {
            return;
        }

        const titleElement =
            document.querySelector('h1.adtitle') ||
            document.querySelector('.ad-titles h1') ||
            document.querySelector('h1');
        if (!titleElement) {
            return;
        }

        const button = document.createElement('button');
        button.id = 'ai-analyze-button';
        button.className = 'ai-analyze-button';
        button.innerHTML = '&#129302; Analyze with AI';

        const pageUrl = window.location.href;
        storageManager
            .getItems()
            .then((items) => {
                const existingItem = items.find((item) => item.url === pageUrl);

                if (existingItem && existingItem.estimation && !existingItem.estimation.error) {
                    button.innerHTML = '&#128257; Re-analyze';
                    button.classList.add('ai-analyze-button--repeat');
                    button.title = 'This item has already been analyzed. Click to re-analyze.';
                    showExistingEstimation(existingItem.estimation);
                }
            })
            .catch((error) => {
                if (error.message.includes('Extension context invalidated')) {
                    console.log('Extension reloaded, using default button state');
                } else {
                    console.error('Error checking button state:', error);
                }
            });

        titleElement.parentNode.insertBefore(button, titleElement.nextSibling);

        const itemData = extractItemData();
        button.itemData = itemData;

        button.addEventListener('click', async function () {
            if (!this.itemData) {
                console.error('❌ Item data not available');
                return;
            }

            let analyzer;
            try {
                analyzer = await ensureAnalyzerReady();
            } catch (error) {
                handleAnalyzerInitError(error);
                return;
            }

            const hadRepeatStyle = this.classList.contains('ai-analyze-button--repeat');
            this.disabled = true;
            this.classList.add('loading');
            this.classList.remove('ai-analyze-button--repeat');
            this.innerHTML = '&#128257; Analyzing...';

            try {
                const estimation = await analyzer.estimateValue(this.itemData);
                const listingPrice =
                    typeof this.itemData.price === 'number' ? this.itemData.price : 0;
                const estimatedValue =
                    typeof estimation?.value === 'number' ? estimation.value : null;
                const isGoodValue =
                    listingPrice > 0 && estimatedValue !== null && estimatedValue > listingPrice;
                estimation.isGoodValue = isGoodValue;

                this.itemData.estimation = estimation;
                this.itemData.isGoodValue = isGoodValue;
                this.itemData.analyzed_at = new Date().toISOString();

                try {
                    await storageManager.saveItem(this.itemData, estimation);
                } catch (error) {
                    if (error.message.includes('Extension context invalidated')) {
                        console.log('Extension reloaded during save, item not saved');
                    } else {
                        throw error;
                    }
                }

                this.classList.remove('loading');
                this.classList.add('ai-analyze-button--repeat');
                this.innerHTML = '&#9989; Analyzed!';
                setTimeout(() => {
                    this.innerHTML = '&#128257; Re-analyze';
                    this.disabled = false;
                }, 2000);

                injectAIEstimate(estimation);
            } catch (error) {
                console.error('Analysis error:', error);
                if (error.message.includes('API key not configured')) {
                    alert('Please configure your Gemini API key in the extension settings.');
                } else {
                    console.error('❌ Analysis failed:', error.message);
                    const errorEstimation = {
                        error: true,
                        errorMessage: error.message || 'Unknown error occurred',
                        value: null,
                        reasoning: 'Analysis failed - please check your API key and try again',
                        confidence: 0,
                        model: 'error',
                        isGoodValue: false
                    };
                    this.itemData.estimation = errorEstimation;
                    this.itemData.isGoodValue = false;
                    this.itemData.analyzed_at = new Date().toISOString();

                    injectAIEstimate(errorEstimation);
                }

                this.classList.remove('loading');
                if (hadRepeatStyle) {
                    this.classList.add('ai-analyze-button--repeat');
                }
                this.innerHTML = '&#128257; Re-analyze';
                this.disabled = false;
            }
        });
    };
}

function handleAnalyzerInitError(error) {
    if (!error) {
        alert('Failed to initialize AI analyzer. Please try again.');
        return;
    }

    if (
        error.code === 'extension-invalidated' ||
        error.message?.includes('Extension context invalidated')
    ) {
        alert('The extension was reloaded. Please click Analyze again.');
        return;
    }

    if (error.code === 'missing-api-key' || error.message?.includes('API key not configured')) {
        alert('Please configure your Gemini API key in the extension settings first.');
        return;
    }

    if (error.code === 'storage-error') {
        alert('Failed to read API key from extension storage.');
        return;
    }

    alert('Failed to initialize AI analyzer. Please check your API key.');
}

module.exports = {
    createInjectAIAnalysisButton
};
