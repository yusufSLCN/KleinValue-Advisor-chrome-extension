// StorageManager wraps chrome.storage access with promise-based helpers and
// applies KleinValue-specific normalization logic.
class StorageManager {
    static async saveItem(itemData, estimation) {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.local.get(['analyzedItems'], (result) => {
                    try {
                        const items = result.analyzedItems || [];
                        const listingPrice = typeof itemData.price === 'number' ? itemData.price : 0;
                        const estimatedValue = typeof estimation?.value === 'number' ? estimation.value : 0;
                        const calculatedGoodValue = listingPrice > 0 && estimatedValue > listingPrice;
                        const isGoodValue = typeof itemData.isGoodValue === 'boolean' ? itemData.isGoodValue : calculatedGoodValue;
                        const normalizedEstimation = {
                            ...estimation,
                            isGoodValue: typeof estimation?.isGoodValue === 'boolean' ? estimation.isGoodValue : isGoodValue
                        };

                        const newItem = {
                            ...itemData,
                            isGoodValue,
                            estimation: normalizedEstimation,
                            analyzedAt: new Date().toISOString(),
                            id: Date.now().toString()
                        };

                        // Check for duplicates based on URL
                        const existingIndex = items.findIndex(item => item.url === itemData.url);
                        if (existingIndex >= 0) {
                            items[existingIndex] = newItem;
                        } else {
                            items.push(newItem);
                        }

                        chrome.storage.local.set({ analyzedItems: items }, () => {
                            if (chrome.runtime.lastError) {
                                reject(new Error('Extension context invalidated'));
                            } else {
                                resolve();
                            }
                        });
                    } catch (error) {
                        reject(error);
                    }
                });
            } catch (error) {
                reject(new Error('Extension context invalidated'));
            }
        });
    }

    static async getItems() {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.local.get(['analyzedItems'], (result) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error('Extension context invalidated'));
                    } else {
                        resolve(result.analyzedItems || []);
                    }
                });
            } catch (error) {
                reject(new Error('Extension context invalidated'));
            }
        });
    }

    static async clearItems() {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.local.set({ analyzedItems: [] }, () => {
                    if (chrome.runtime.lastError) {
                        reject(new Error('Extension context invalidated'));
                    } else {
                        resolve();
                    }
                });
            } catch (error) {
                reject(new Error('Extension context invalidated'));
            }
        });
    }

    static async getApiKey() {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.local.get(['geminiApiKey'], (result) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error('Extension context invalidated'));
                    } else {
                        resolve(result.geminiApiKey);
                    }
                });
            } catch (error) {
                reject(new Error('Extension context invalidated'));
            }
        });
    }

    static async setApiKey(apiKey) {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.local.set({ geminiApiKey: apiKey }, () => {
                    if (chrome.runtime.lastError) {
                        reject(new Error('Extension context invalidated'));
                    } else {
                        resolve();
                    }
                });
            } catch (error) {
                reject(new Error('Extension context invalidated'));
            }
        });
    }

    static async getSettings() {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.local.get([
                    'modelName',
                    'maxImages',
                    'enableImages',
                    'autoAnalyze',
                    'confidenceThreshold',
                    'temperature',
                    'randomSeed',
                    'topP',
                    'topK'
                ], (result) => {
                    if (chrome.runtime.lastError) {
                        console.error('Error getting settings:', chrome.runtime.lastError);
                        reject(new Error('Extension context invalidated'));
                    } else {
                        console.log('StorageManager.getSettings - chrome.storage.local.get result:', result);
                        const settings = {
                            modelName: result.modelName || 'gemini-2.5-flash',
                            maxImages: result.maxImages || 4,
                            enableImages: result.enableImages !== false,
                            autoAnalyze: result.autoAnalyze !== false,
                            confidenceThreshold: typeof result.confidenceThreshold === 'number'
                                ? Math.min(Math.max(result.confidenceThreshold, 0), 100)
                                : 70,
                            temperature: typeof result.temperature === 'number'
                                ? Math.min(Math.max(result.temperature, 0), 2)
                                : 0,
                            randomSeed: Number.isInteger(result.randomSeed) && result.randomSeed >= 0
                                ? result.randomSeed
                                : 1337,
                            topP: typeof result.topP === 'number'
                                ? Math.min(Math.max(result.topP, 0), 1)
                                : 1,
                            topK: Number.isInteger(result.topK) && result.topK > 0 ? result.topK : undefined
                        };
                        console.log('StorageManager.getSettings - resolved settings:', settings);
                        resolve(settings);
                    }
                });
            } catch (error) {
                reject(new Error('Extension context invalidated'));
            }
        });
    }
}

module.exports = StorageManager;
