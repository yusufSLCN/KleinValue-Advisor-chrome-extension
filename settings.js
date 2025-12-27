document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('api-key');
    const modelSelect = document.getElementById('model-name');
    const maxImagesInput = document.getElementById('max-images');
    const enableImagesCheckbox = document.getElementById('enable-images');
    const autoAnalyzeCheckbox = document.getElementById('auto-analyze');
    const saveButton = document.getElementById('save');
    const testButton = document.getElementById('test');
    const statusDiv = document.getElementById('status');

    // Load existing settings
    chrome.storage.local.get([
        'geminiApiKey',
        'modelName',
        'maxImages',
        'enableImages',
        'autoAnalyze'
    ], (result) => {
        console.log('Settings loaded from storage:', result);
        if (result.geminiApiKey) {
            apiKeyInput.value = result.geminiApiKey;
        }
        if (result.modelName) {
            modelSelect.value = result.modelName;
        }
        if (result.maxImages !== undefined) {
            maxImagesInput.value = result.maxImages;
        }
        if (result.enableImages !== undefined) {
            enableImagesCheckbox.checked = result.enableImages;
        }
        if (result.autoAnalyze !== undefined) {
            autoAnalyzeCheckbox.checked = result.autoAnalyze;
        }
    });

    // Save settings
    saveButton.addEventListener('click', () => {
        const apiKey = apiKeyInput.value.trim();
        const modelName = modelSelect.value;
        const maxImages = parseInt(maxImagesInput.value);
        const enableImages = enableImagesCheckbox.checked;
        const autoAnalyze = autoAnalyzeCheckbox.checked;

        // Validation
        if (!apiKey) {
            showStatus('Please enter an API key', 'error');
            return;
        }
        if (maxImages < 1 || maxImages > 10) {
            showStatus('Maximum images must be between 1 and 10', 'error');
            return;
        }
        const settings = {
            geminiApiKey: apiKey,
            modelName: modelName,
            maxImages: maxImages,
            enableImages: enableImages,
            autoAnalyze: autoAnalyze
        };

        console.log('Saving settings:', settings);

        chrome.storage.local.set(settings, () => {
            if (chrome.runtime.lastError) {
                console.error('Error saving settings:', chrome.runtime.lastError);
                showStatus('Error saving settings: ' + chrome.runtime.lastError.message, 'error');
            } else {
                console.log('Settings saved to chrome.storage.local:', settings);
                // Clear the global estimator so it gets recreated with new settings
                if (window.globalEstimator) {
                    window.globalEstimator = null;
                    console.log('Cleared global estimator');
                }
                showStatus('✅ Settings saved successfully!', 'success');
            }
        });
    });

    // Test API key
    testButton.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();
        const modelName = modelSelect.value;
        if (!apiKey) {
            showStatus('Please enter an API key first', 'error');
            return;
        }

        showStatus('🧪 Testing API key and model...', 'info');
        testButton.disabled = true;

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: 'Hello, test message for API validation.' }]
                    }]
                })
            });

            if (response.ok) {
                showStatus(`✅ API key and ${modelName} model are working!`, 'success');
            } else {
                const error = await response.json();
                throw new Error(error.error?.message || 'API test failed');
            }
        } catch (error) {
            showStatus('❌ Test failed: ' + error.message, 'error');
        } finally {
            testButton.disabled = false;
        }
    });

    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;
        statusDiv.style.display = 'block';

        // Auto-hide success messages
        if (type === 'success') {
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 3000);
        }
    }
});