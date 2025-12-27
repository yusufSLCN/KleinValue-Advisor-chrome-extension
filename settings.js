document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('api-key');
    const modelSelect = document.getElementById('model-name');
    const maxImagesInput = document.getElementById('max-images');
    const enableImagesCheckbox = document.getElementById('enable-images');
    const autoAnalyzeCheckbox = document.getElementById('auto-analyze');
    const confidenceThresholdInput = document.getElementById('confidence-threshold');
    const temperatureInput = document.getElementById('temperature');
    const randomSeedInput = document.getElementById('random-seed');
    const saveButton = document.getElementById('save');
    const testButton = document.getElementById('test');
    const statusDiv = document.getElementById('status');

    // Load existing settings
    chrome.storage.local.get([
        'geminiApiKey',
        'modelName',
        'maxImages',
        'enableImages',
        'autoAnalyze',
        'confidenceThreshold',
        'temperature',
        'randomSeed'
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
        if (result.confidenceThreshold !== undefined) {
            confidenceThresholdInput.value = result.confidenceThreshold;
        }
        if (result.temperature !== undefined && temperatureInput) {
            temperatureInput.value = result.temperature;
        }
        if (result.randomSeed !== undefined && randomSeedInput) {
            randomSeedInput.value = result.randomSeed;
        }
    });

    // Save settings
    saveButton.addEventListener('click', () => {
        const apiKey = apiKeyInput.value.trim();
        const modelName = modelSelect.value;
        const maxImages = parseInt(maxImagesInput.value);
        const enableImages = enableImagesCheckbox.checked;
        const autoAnalyze = autoAnalyzeCheckbox.checked;
        const confidenceThreshold = parseInt(confidenceThresholdInput.value);
        const temperature = temperatureInput ? parseFloat(temperatureInput.value) : 0;
        const randomSeed = randomSeedInput ? parseInt(randomSeedInput.value, 10) : 1337;

        // Validation
        if (!apiKey) {
            showStatus('Please enter an API key', 'error');
            return;
        }
        if (maxImages < 1 || maxImages > 10) {
            showStatus('Maximum images must be between 1 and 10', 'error');
            return;
        }
        if (isNaN(confidenceThreshold) || confidenceThreshold < 0 || confidenceThreshold > 100) {
            showStatus('Confidence threshold must be between 0 and 100', 'error');
            return;
        }
        if (isNaN(temperature) || temperature < 0 || temperature > 2) {
            showStatus('Temperature must be between 0 and 2', 'error');
            return;
        }
        if (!Number.isInteger(randomSeed) || randomSeed < 0 || randomSeed > 2147483647) {
            showStatus('Seed must be a whole number between 0 and 2,147,483,647', 'error');
            return;
        }
        const settings = {
            geminiApiKey: apiKey,
            modelName: modelName,
            maxImages: maxImages,
            enableImages: enableImages,
            autoAnalyze: autoAnalyze,
            confidenceThreshold: confidenceThreshold,
            temperature: temperature,
            randomSeed: randomSeed
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