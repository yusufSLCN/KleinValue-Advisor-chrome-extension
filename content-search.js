/**
 * Content script for Kleinanzeigen Search Pages
 * Adds AI price indicators to search result items
 */

console.log('🔍 Search script loaded on:', window.location.href);
console.log('🔍 Pathname:', window.location.pathname);

// Check if we're on an item detail page and exit if so
if (window.location.pathname.includes('/s-anzeige/')) {
    console.log('🔍 On item page, exiting search script');
} else {
    console.log('🔍 On search page, initializing price indicators');
    
    // Wait for page to load
    document.addEventListener('DOMContentLoaded', function() {
        console.log('🔍 DOMContentLoaded fired');
        addPriceIndicators();
    });

    // Also run immediately in case DOM is already loaded
    if (document.readyState !== 'loading') {
        console.log('🔍 DOM already ready, running immediately');
        addPriceIndicators();
    }

    // Also observe for dynamic content loading
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
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
        console.log('🔍 Adding price indicators...');
        // Get all analyzed items from storage
        const analyzedItems = await window.StorageManager.getItems();
        console.log('🔍 Found', analyzedItems.length, 'analyzed items');
        
        if (!analyzedItems || analyzedItems.length === 0) {
            console.log('🔍 No analyzed items yet');
            return;
        }

        // Find all search result items on the page
        const searchItems = document.querySelectorAll('article.aditem, li.ad-listitem, [data-adid]');
        console.log('🔍 Found', searchItems.length, 'search items on page');
        
        searchItems.forEach(itemElement => {
            // Skip if we already added an indicator to this element
            if (itemElement.querySelector('.ai-price-indicator')) {
                return;
            }

            // Extract the URL from the item
            const linkElement = itemElement.querySelector('a[href*="/s-anzeige/"]');
            if (!linkElement) {
                return;
            }

            const itemUrl = linkElement.href;
            
            // Check if this item has been analyzed
            const analyzedItem = analyzedItems.find(item => item.url === itemUrl);
            
            if (analyzedItem && analyzedItem.estimation && !analyzedItem.estimation.error) {
                console.log('🔍 Injecting badge for:', analyzedItem.title);
                injectPriceIndicator(itemElement, analyzedItem);
            }
        });
    } catch (error) {
        console.error('🔍 Error adding price indicators:', error);
    }
}

function injectPriceIndicator(itemElement, analyzedItem) {
    const priceElement = itemElement.querySelector('.aditem-main--middle--price-shipping--price, .price, [class*="price"]');
    
    if (!priceElement) {
        console.log('🔍 No price element found in item');
        return;
    }

    const estimation = analyzedItem.estimation;
    const aiPrice = estimation.value;
    const confidence = estimation.confidence || 70;
    const listedPrice = analyzedItem.price || 0;
    const isBargain = listedPrice > 0 && aiPrice > listedPrice * 1.2;
    
    const indicator = document.createElement('div');
    indicator.className = 'ai-price-indicator';
    indicator.style.cssText = `
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-left: 8px;
        padding: 3px 8px;
        background: ${isBargain ? 'linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%)' : 'linear-gradient(135deg, #e9ecef 0%, #dee2e6 100%)'};
        border: 1px solid ${isBargain ? '#28a745' : '#adb5bd'};
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
        color: ${isBargain ? '#155724' : '#495057'};
        cursor: help;
        transition: all 0.2s ease;
        white-space: nowrap;
    `;
    
    indicator.innerHTML = `
        <span style="font-size: 12px;">${isBargain ? '💎' : '🤖'}</span>
        <span>€${aiPrice.toFixed(0)}</span>
    `;
    
    const tooltip = document.createElement('div');
    tooltip.className = 'ai-price-tooltip';
    tooltip.style.cssText = `
        position: absolute;
        display: none;
        background: rgba(0, 0, 0, 0.95);
        color: white;
        padding: 10px 12px;
        border-radius: 6px;
        font-size: 11px;
        line-height: 1.5;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        max-width: 250px;
        white-space: normal;
        pointer-events: none;
    `;
    
    tooltip.innerHTML = `
        <strong>AI Estimate: €${aiPrice.toFixed(2)}</strong><br>
        ${listedPrice > 0 ? `Listed: €${listedPrice.toFixed(2)}<br>` : ''}
        Confidence: ${confidence}%<br>
        ${isBargain ? '<span style="color: #d4edda;">🎯 Potential Bargain!</span>' : ''}
    `;
    
    indicator.addEventListener('mouseenter', (e) => {
        indicator.style.transform = 'scale(1.05)';
        indicator.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
        document.body.appendChild(tooltip);
        tooltip.style.display = 'block';
        const rect = indicator.getBoundingClientRect();
        tooltip.style.top = (rect.top - tooltip.offsetHeight - 8 + window.scrollY) + 'px';
        tooltip.style.left = (rect.left + rect.width / 2 - tooltip.offsetWidth / 2 + window.scrollX) + 'px';
    });
    
    indicator.addEventListener('mouseleave', () => {
        indicator.style.transform = 'scale(1)';
        indicator.style.boxShadow = 'none';
        if (tooltip.parentNode) {
            tooltip.parentNode.removeChild(tooltip);
        }
    });
    
    priceElement.style.display = 'flex';
    priceElement.style.alignItems = 'center';
    priceElement.style.flexWrap = 'wrap';
    priceElement.appendChild(indicator);
    
    console.log('🔍 Badge injected successfully');
}
