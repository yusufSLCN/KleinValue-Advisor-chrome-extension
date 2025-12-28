const priceSelectors = [
    '.ad-price',
    '[data-qa="price"]',
    '.price',
    '.aditem-price',
    '[class*="price"]'
];

let activeEstimateElements = null;
let outsideClickHandlerRegistered = false;

function handleAIEstimateOutsideClick(event) {
    if (!activeEstimateElements) {
        return;
    }

    const { container, panel, setExpanded } = activeEstimateElements;
    if (!container || !panel || !setExpanded) {
        return;
    }

    if (!container.classList.contains('expanded')) {
        return;
    }

    if (!container.contains(event.target) && !panel.contains(event.target)) {
        setExpanded(false);
    }
}

function registerOutsideClickHandler() {
    if (outsideClickHandlerRegistered) {
        return;
    }

    document.addEventListener('click', handleAIEstimateOutsideClick);
    outsideClickHandlerRegistered = true;
}

function findPriceElement() {
    for (const selector of priceSelectors) {
        const priceElement = document.querySelector(selector);
        if (priceElement) {
            return priceElement;
        }
    }

    return null;
}

function showExistingEstimation(estimation) {
    const priceElement = findPriceElement();
    if (!priceElement) {
        return;
    }

    attachAIEstimateToPrice(priceElement, estimation);
}

function attachAIEstimateToPrice(priceElement, estimation = {}) {
    if (!priceElement) {
        return;
    }

    const existingBadge = document.getElementById('ai-estimate-container');
    if (existingBadge) {
        existingBadge.remove();
    }

    const existingPanel = priceElement.querySelector('.ai-details-panel');
    if (existingPanel) {
        existingPanel.remove();
    } else {
        const strayPanel = document.querySelector('.ai-details-panel');
        if (strayPanel) {
            strayPanel.remove();
        }
    }

    const value = estimation.value;
    const reasoning = estimation.reasoning;
    const confidence = estimation.confidence || 70;
    const cost = estimation.estimatedCost;
    const isError = estimation.error === true;
    const hasNumericValue = typeof value === 'number' && Number.isFinite(value);
    const summaryValue = hasNumericValue ? value.toFixed(0) : 'N/A';
    const detailedValue = hasNumericValue ? value.toFixed(2) : 'N/A';
    const providerLabel = estimation.providerName || estimation.provider || '';

    const estimateContainer = document.createElement('div');
    estimateContainer.id = 'ai-estimate-container';
    estimateContainer.className = 'ai-estimate-badge';

    const summaryText = document.createElement('div');
    summaryText.className = 'ai-estimate-summary';
    summaryText.innerHTML = `🤖 €${summaryValue} <span class="ai-estimate-toggle">▼</span>`;
    const toggleIcon = summaryText.querySelector('.ai-estimate-toggle');
    estimateContainer.appendChild(summaryText);

    const detailsPanel = document.createElement('div');
    detailsPanel.className = 'ai-details-panel';
    detailsPanel.innerHTML = `
        <div class="ai-details-header">
            <div>
                <strong class="ai-details-title">AI Estimate: €${detailedValue}</strong>
                <div class="ai-details-subtitle">Confidence: ${confidence}%</div>
            </div>
        </div>
        <div class="ai-details-body">
            <strong class="ai-details-section-title">Reasoning:</strong>
            <div class="ai-details-section-text">${reasoning || 'No reasoning provided'}</div>
        </div>
        <div class="ai-details-footer">
            ${estimation.model ? `<div><strong>Model:</strong> ${providerLabel ? `${providerLabel} · ` : ''}${estimation.model}</div>` : ''}
            ${!estimation.model && providerLabel ? `<div><strong>Provider:</strong> ${providerLabel}</div>` : ''}
            ${!isError && cost ? `<div><strong>API Cost:</strong> ${cost.formatted}${typeof cost.totalTokens === 'number' ? ` (${cost.totalTokens} tokens)` : ''}</div>` : ''}
        </div>
    `;

    let expanded = false;
    function setExpanded(state) {
        expanded = state;
        estimateContainer.classList.toggle('expanded', expanded);
        detailsPanel.classList.toggle('visible', expanded);
        if (toggleIcon) {
            toggleIcon.textContent = expanded ? '▲' : '▼';
        }
    }

    estimateContainer.addEventListener('click', function(e) {
        e.stopPropagation();
        setExpanded(!expanded);
    });

    priceElement.classList.add('ai-price-wrapper');
    priceElement.appendChild(estimateContainer);
    priceElement.appendChild(detailsPanel);

    activeEstimateElements = {
        container: estimateContainer,
        panel: detailsPanel,
        setExpanded
    };
}

function injectAIEstimate(estimation) {
    const priceElement = findPriceElement();
    if (!priceElement) {
        return;
    }

    attachAIEstimateToPrice(priceElement, estimation);
}

module.exports = {
    registerOutsideClickHandler,
    findPriceElement,
    showExistingEstimation,
    attachAIEstimateToPrice,
    injectAIEstimate
};
