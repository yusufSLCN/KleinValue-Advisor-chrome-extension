/**
 * Popup script for Kleinanzeigen AI Analyzer
 * Loads and displays saved analyzed items from storage
 */

document.addEventListener('DOMContentLoaded', async function() {
    await loadApiKeyStatus();
    loadAnalyzedItems();
    setupClearButton();
    setupExpandButton();
    setupSettingsButton();
});

function loadAnalyzedItems() {
    chrome.storage.local.get(['analyzedItems'], function(data) {
        const itemsContainer = document.getElementById('items-container');
        const clearButton = document.getElementById('clear-all');

        let analyzedItems = data.analyzedItems || [];

        if (analyzedItems.length === 0) {
            itemsContainer.innerHTML = '<div class="empty-state">No analyzed items yet. Analyze some on Kleinanzeigen!</div>';
            clearButton.style.display = 'none';
            return;
        }

        // Sort items by most recent analysis time (analyzedAt) in descending order
        analyzedItems.sort(function(a, b) {
            const timeA = getAnalyzedDate(a)?.getTime() || 0;
            const timeB = getAnalyzedDate(b)?.getTime() || 0;
            return timeB - timeA; // Most recent first
        });

        clearButton.style.display = 'block';
        itemsContainer.innerHTML = '';

        analyzedItems.forEach(function(item) {
            const itemCard = document.createElement('div');
            itemCard.className = 'item-card';

            // Image
            const image = document.createElement('img');
            image.className = 'item-image';
            if (item.images && item.images.length > 0) {
                image.src = item.images[0];
                image.onerror = function() {
                    this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjZjNmNGY2Ii8+CjxwYXRoIGQ9Ik0yMCAyMGgxMnYxMkgxOFoiIGZpbGw9IiM5Y2E0YWYiLz4KPHBhdGggZD0iTTMwIDIwaDEwdjEwaC0xMFoiIGZpbGw9IiM5Y2E0YWYiLz4KPHBhdGggZD0iTTIwIDMwaDEwdjEwaC0xMFoiIGZpbGw9IiM5Y2E0YWYiLz4KPHBhdGggZD0iTTMwIDMwaDEwdjEwaC0xMFoiIGZpbGw9IiM5Y2E0YWYiLz4KPC9zdmc+';
                };
            } else {
                image.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjZjNmNGY2Ii8+CjxwYXRoIGQ9Ik0yMCAyMGgxMnYxMkgxOFoiIGZpbGw9IiM5Y2E0YWYiLz4KPHBhdGggZD0iTTMwIDIwaDEwdjEwaC0xMFoiIGZpbGw9IiM5Y2E0YWYiLz4KPHBhdGggZD0iTTIwIDMwaDEwdjEwaC0xMFoiIGZpbGw9IiM5Y2E0YWYiLz4KPHBhdGggZD0iTTMwIDMwaDEwdjEwaC0xMFoiIGZpbGw9IiM5Y2E0YWYiLz4KPC9zdmc+';
            }

            const contentDiv = document.createElement('div');
            contentDiv.className = 'item-content';

            // Title
            const titleLink = document.createElement('a');
            titleLink.className = 'item-title';
            titleLink.href = item.url;
            titleLink.target = '_blank';
            titleLink.rel = 'noopener noreferrer';
            titleLink.textContent = item.title;

            const analyzedDate = getAnalyzedDate(item);
            const metaParts = [];
            if (item.location && item.location !== 'Unknown') {
                metaParts.push(`📍 ${item.location}`);
            }
            if (analyzedDate) {
                metaParts.push(`Analyzed ${formatAnalyzedDate(analyzedDate)}`);
            }

            const metaLine = document.createElement('div');
            metaLine.className = 'item-meta';
            metaLine.textContent = metaParts.join('\n');

            // Prices
            const pricesDiv = document.createElement('div');
            pricesDiv.className = 'item-prices';

            if (item.price && item.price > 0) {
                const realPrice = document.createElement('span');
                realPrice.className = 'item-price-real';
                realPrice.textContent = `Listed: €${item.price.toFixed(2)}`;
                pricesDiv.appendChild(realPrice);

                // Add separator
                const separator = document.createElement('span');
                separator.textContent = ' | ';
                separator.style.color = '#6c757d';
                separator.style.fontSize = '12px';
                pricesDiv.appendChild(separator);
            }

            const aiPrice = document.createElement('span');
            aiPrice.className = 'item-price-ai';
            if (item.estimation && item.estimation.value !== null && item.estimation.value !== undefined) {
                aiPrice.textContent = `AI: €${item.estimation.value.toFixed(2)}`;
            } else {
                aiPrice.textContent = 'AI: N/A';
                aiPrice.style.color = '#6c757d';
            }
            pricesDiv.appendChild(aiPrice);

            // Reasoning (truncated)
            const reasoning = document.createElement('div');
            reasoning.className = 'item-reasoning';
            if (item.estimation && item.estimation.reasoning) {
                reasoning.textContent = item.estimation.reasoning;
            } else {
                reasoning.textContent = 'No reasoning available';
            }

            // Assemble the card
            contentDiv.appendChild(titleLink);
            if (metaLine.textContent) {
                contentDiv.appendChild(metaLine);
            }
            contentDiv.appendChild(pricesDiv);
            contentDiv.appendChild(reasoning);

            itemCard.appendChild(image);
            itemCard.appendChild(contentDiv);

            itemsContainer.appendChild(itemCard);
        });
    });
}

function getAnalyzedDate(item) {
    const raw = item?.analyzedAt || item?.analyzed_at;
    if (!raw) {
        return null;
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatAnalyzedDate(dateObj) {
    if (!dateObj || Number.isNaN(dateObj.getTime())) {
        return '';
    }
    return dateObj.toLocaleString('de-DE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function setupClearButton() {
    document.getElementById('clear-all').addEventListener('click', function() {
        if (confirm('Clear all analyzed items?')) {
            chrome.storage.local.set({analyzedItems: []}, function() {
                loadAnalyzedItems();
            });
        }
    });
}

async function loadApiKeyStatus() {
    const result = await chrome.storage.local.get(['geminiApiKey']);
    const statusElement = document.getElementById('api-key-status');
    if (statusElement) {
        statusElement.textContent = result.geminiApiKey ? '✅ Configured' : '❌ Not configured';
        statusElement.style.color = result.geminiApiKey ? '#28a745' : '#dc3545';
    }
}

function setupSettingsButton() {
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', function() {
            chrome.tabs.create({
                url: chrome.runtime.getURL('settings.html'),
                active: true
            });
        });
    }
}

function setupExpandButton() {
    const expandBtn = document.getElementById('expand-btn');
    if (expandBtn) {
        expandBtn.addEventListener('click', function() {
            // Open the extension dashboard in a new tab
            chrome.management.getSelf((info) => {
                const dashboardUrl = `chrome-extension://${info.id}/dashboard.html`;
                chrome.tabs.create({ url: dashboardUrl });
            });
        });

        // Add hover effects
        expandBtn.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-1px)';
            this.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
        });

        expandBtn.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        });
    }
}