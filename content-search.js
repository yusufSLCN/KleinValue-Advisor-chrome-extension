/**
 * Content script for Kleinanzeigen Search Pages
 * Adds AI price indicators to search result items
 */

// Check if we're on an item detail page and exit if so
if (!window.location.pathname.includes('/s-anzeige/')) {
    // Wait for page to load
    document.addEventListener('DOMContentLoaded', function () {
        addPriceIndicators();
    });

    // Also run immediately in case DOM is already loaded
    if (document.readyState !== 'loading') {
        addPriceIndicators();
    }

    // Also observe for dynamic content loading
    const observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            if (mutation.type === 'childList') {
                addPriceIndicators();
            }
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

async function addPriceIndicators() {
    try {
        // Check if StorageManager is available
        if (!window.StorageManager) {
            console.error('StorageManager not available');
            return;
        }

        const analyzedItems = await window.StorageManager.getItems();

        if (!analyzedItems || analyzedItems.length === 0) {
            return;
        }

        const searchItems = document.querySelectorAll(
            'article.aditem, li.ad-listitem, [data-adid]'
        );

        searchItems.forEach((itemElement) => {
            if (itemElement.querySelector('.ai-price-indicator')) {
                return;
            }

            const linkElement = itemElement.querySelector('a[href*="/s-anzeige/"]');
            if (!linkElement) {
                return;
            }

            const itemUrl = linkElement.href;
            const analyzedItem = analyzedItems.find((item) => item.url === itemUrl);

            if (analyzedItem && analyzedItem.estimation && !analyzedItem.estimation.error) {
                injectPriceIndicator(itemElement, analyzedItem);
            }
        });
    } catch (error) {
        console.error('Error adding price indicators:', error);
    }
}

function injectPriceIndicator(itemElement, analyzedItem) {
    const priceElement = itemElement.querySelector(
        '.aditem-main--middle--price-shipping--price, .price, [class*="price"]'
    );

    if (!priceElement) {
        return;
    }

    const estimation = analyzedItem.estimation;
    const aiPrice = estimation.value;
    const confidence = estimation.confidence || 70;

    // Extract listed price from the item
    let listedPrice = 0;
    if (analyzedItem.price && typeof analyzedItem.price === 'string') {
        listedPrice = parseFloat(analyzedItem.price.replace('€', '').replace(',', '.').trim()) || 0;
    } else if (typeof analyzedItem.price === 'number') {
        listedPrice = analyzedItem.price;
    }

    const storedGoodValue =
        typeof analyzedItem.isGoodValue === 'boolean' ? analyzedItem.isGoodValue : undefined;
    const computedGoodValue =
        listedPrice > 0 && typeof aiPrice === 'number' && aiPrice > listedPrice;
    const isGoodValue = storedGoodValue !== undefined ? storedGoodValue : computedGoodValue;
    const label = isGoodValue ? 'Good Value' : 'AI Estimate';

    const displayEstimate =
        typeof aiPrice === 'number' && Number.isFinite(aiPrice) ? aiPrice : null;
    const summarizedEstimate = displayEstimate !== null ? displayEstimate.toFixed(0) : 'N/A';
    const detailedEstimate = displayEstimate !== null ? displayEstimate.toFixed(2) : 'N/A';

    const indicator = document.createElement('div');
    indicator.className = 'ai-price-indicator';
    indicator.classList.toggle('good-value', isGoodValue);
    indicator.innerHTML = `
        <span class="ai-price-indicator__icon">${isGoodValue ? '💎' : '🤖'}</span>
        <span class="ai-price-indicator__label">${label}: €${summarizedEstimate}</span>
    `;

    const tooltip = document.createElement('div');
    tooltip.className = 'ai-price-tooltip';
    tooltip.innerHTML = `
        <strong>AI Estimate: €${detailedEstimate}</strong><br>
        ${listedPrice > 0 ? `Listed: €${listedPrice.toFixed(2)}<br>` : ''}
        Confidence: ${confidence}%<br>
        ${isGoodValue ? '<span class="ai-price-tooltip__good">🎯 Marked as Good Value</span>' : ''}
    `;

    indicator.addEventListener('mouseenter', () => {
        if (!document.body.contains(tooltip)) {
            document.body.appendChild(tooltip);
        }
        tooltip.classList.add('visible');
        const rect = indicator.getBoundingClientRect();
        tooltip.style.top = `${rect.top - tooltip.offsetHeight - 8 + window.scrollY}px`;
        tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2 + window.scrollX}px`;
    });

    indicator.addEventListener('mouseleave', () => {
        tooltip.classList.remove('visible');
        if (tooltip.parentNode) {
            tooltip.parentNode.removeChild(tooltip);
        }
    });

    priceElement.classList.add('ai-price-wrapper');
    priceElement.appendChild(indicator);
}
