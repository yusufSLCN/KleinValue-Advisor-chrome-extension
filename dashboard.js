class DashboardManager {
    constructor() {
        this.items = [];
        this.filteredItems = [];
        this.searchQuery = '';
        this.statsExpanded = false;
        this.goodValueFilter = false;
        this.initialize();
    }

    async initialize() {
        await this.loadItems();
        this.updateStats();
        this.renderItems();
        this.setupEventListeners();
        this.updateItemsCount();
    }

    async loadItems() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['analyzedItems'], (result) => {
                this.items = result.analyzedItems || [];
                this.filteredItems = [...this.items];
                resolve(this.items);
            });
        });
    }

    updateStats() {
        // Filter out items with analysis errors
        const validItems = this.items.filter(item => !item.estimation?.error);

        // Price ranges (only from valid analyses)
        const priceRanges = this.computeDynamicPriceRanges(validItems);
        const maxCount = Math.max(...priceRanges.map(range => range.count), 1);
        const priceRangesHtml = `
            <div class="bar-chart">
                ${priceRanges.map(({ label, count }) => {
                    const height = maxCount > 0 ? (count / maxCount) * 100 : 0;
                    return `<div class="bar-container">
                        <div class="bar" style="height: ${height}%">
                            <span class="bar-value">${count}</span>
                        </div>
                        <span class="bar-label">${label}</span>
                    </div>`;
                }).join('')}
            </div>
        `;

        // Good value opportunities (only from valid analyses)
        const goodValueCount = validItems.filter(item => this.isGoodValue(item)).length;

        // Recent items (last 24h) - count all items, not just valid ones
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentItems = this.items.filter(item => new Date(item.analyzedAt || 0) > oneDayAgo).length;

        const priceRangesEl = document.getElementById('price-ranges');
        const goodValueEl = document.getElementById('good-value-count');
        const recentEl = document.getElementById('recent-items');

        if (priceRangesEl) priceRangesEl.innerHTML = priceRangesHtml;
        if (goodValueEl) goodValueEl.textContent = goodValueCount;
        if (recentEl) recentEl.textContent = recentItems;
    }


    updateItemsCount() {
        const count = this.filteredItems.length;
        const total = this.items.length;
        document.getElementById('items-count').textContent =
            this.searchQuery ? `${count} of ${total} items` : `${total} items`;
    }

    filterItems() {
        let filtered = [...this.items];

        // Apply search filter
        if (this.searchQuery.trim()) {
            const query = this.searchQuery.toLowerCase();
            filtered = filtered.filter(item =>
                item.title.toLowerCase().includes(query) ||
                item.location?.toLowerCase().includes(query) ||
                item.estimation?.reasoning?.toLowerCase().includes(query)
            );
        }

        // Apply good value filter
        if (this.goodValueFilter) {
            filtered = filtered.filter(item => this.isGoodValue(item));
        }

        this.filteredItems = filtered;
        this.updateItemsCount();
        this.renderItems();
    }

    toggleStats() {
        this.statsExpanded = !this.statsExpanded;
        const statsSection = document.getElementById('stats-section');
        const toggleButton = document.getElementById('stats-toggle');

        if (this.statsExpanded) {
            statsSection.classList.add('expanded');
            toggleButton.textContent = '📊 Hide Statistics';
        } else {
            statsSection.classList.remove('expanded');
            toggleButton.textContent = '📊 Show Statistics';
        }
    }

    renderItems() {
        const container = document.getElementById('items-container');
        container.innerHTML = '';

        if (this.filteredItems.length === 0) {
            if (this.items.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <h3>No analyzed items yet</h3>
                        <p>Visit Kleinanzeigen and use the "🤖 Analyze with AI" button to start analyzing items.</p>
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <div class="empty-state">
                        <h3>No items match your search</h3>
                        <p>Try adjusting your search terms.</p>
                    </div>
                `;
            }
            return;
        }

        // Sort by analysis date (newest first)
        const sortedItems = [...this.filteredItems].sort((a, b) =>
            new Date(b.analyzedAt || 0) - new Date(a.analyzedAt || 0)
        );

        sortedItems.forEach(item => {
            const itemElement = this.createItemElement(item);
            container.appendChild(itemElement);
        });
    }

    createItemElement(item) {
        const div = document.createElement('div');
        div.className = 'item-card';

        const imageHtml = item.images && item.images.length > 0
            ? `<img src="${item.images[0]}" alt="${item.title}" class="item-image" onerror="this.style.display='none'">`
            : '<div class="item-image" style="display: flex; align-items: center; justify-content: center; color: #6c757d; font-size: 1.2em;">📷</div>';

        const reasoningText = item.estimation?.reasoning ? this.escapeHtml(item.estimation.reasoning) : 'No reasoning available';

        div.innerHTML = `
            ${imageHtml}
            <div class="item-content">
                <div class="item-title">${this.escapeHtml(item.title)}</div>
                <div class="item-meta">
                    <div class="item-location">
                        <span>📍</span>
                        <span>${item.location || 'Unknown'}</span>
                    </div>
                    <div class="item-date">
                        <span>🕒</span>
                        <span>${this.formatDate(item.analyzedAt)}</span>
                    </div>
                </div>
                <div class="price-comparison">
                    <div class="listing-price">
                        💰 Listed: €${item.price || 'N/A'}
                    </div>
                    <div class="estimation">
                        ${item.estimation?.error ?
                            `❌ Analysis Failed: ${item.estimation.errorMessage || 'Unknown error'}` :
                            `🤖 AI Estimate: €${item.estimation?.value || 0}`
                        }
                        ${item.estimation?.reasoning && !item.estimation.error ? '<span class="reasoning-icon" title="Hover for AI reasoning">ℹ️</span>' : ''}
                        ${item.estimation?.model && !item.estimation.error ? `<small class="model-info">via ${item.estimation.model.replace('gemini-', '').replace('-latest', '')}</small>` : ''}
                    </div>
                </div>
                <div class="item-actions">
                    <a href="${item.url}" target="_blank" class="btn-secondary">
                        <span>🔗</span>
                        View
                    </a>
                    <button class="btn-danger remove-btn" data-item-id="${item.id || item.url}">
                        <span>🗑️</span>
                    </button>
                </div>
                <div class="reasoning-tooltip">${reasoningText}</div>
            </div>
        `;

        // Add event listeners
        const removeBtn = div.querySelector('.remove-btn');
        const reasoningIcon = div.querySelector('.reasoning-icon');
        const tooltip = div.querySelector('.reasoning-tooltip');

        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                this.removeItem(item.id || item.url);
            });
        }

        if (reasoningIcon && tooltip) {
            reasoningIcon.addEventListener('mouseenter', () => {
                tooltip.style.display = 'block';
                // Position tooltip above the AI estimate to avoid clipping
                const estimateRect = reasoningIcon.parentElement.getBoundingClientRect();
                const cardRect = div.getBoundingClientRect();
                tooltip.style.left = (estimateRect.left - cardRect.left + estimateRect.width / 2) + 'px';
                tooltip.style.top = (estimateRect.top - cardRect.top - tooltip.offsetHeight - 8) + 'px';
                tooltip.style.transform = 'translateX(-50%)';
                tooltip.style.zIndex = '10000';
            });

            reasoningIcon.addEventListener('mouseleave', () => {
                tooltip.style.display = 'none';
            });

            // Also hide on mouse leave from tooltip
            tooltip.addEventListener('mouseleave', () => {
                tooltip.style.display = 'none';
            });
        }

        return div;
    }

    isGoodValue(item) {
        if (!item || item.estimation?.error) {
            return false;
        }
        if (typeof item.isGoodValue === 'boolean') {
            return item.isGoodValue;
        }
        const listingPrice = typeof item.price === 'number' ? item.price : 0;
        const estimate = typeof item.estimation?.value === 'number' ? item.estimation.value : 0;
        return listingPrice > 0 && estimate > listingPrice;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDate(dateString) {
        if (!dateString) return 'Unknown';
        return new Date(dateString).toLocaleDateString('en-DE', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('search-input');
        searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            this.filterItems();
        });

        // Stats toggle
        const statsToggle = document.getElementById('stats-toggle');
        statsToggle.addEventListener('click', () => {
            this.toggleStats();
        });

        // Good value filter
        const goodValueCard = document.getElementById('good-value-card');
        if (goodValueCard) {
            goodValueCard.addEventListener('click', () => {
                this.goodValueFilter = !this.goodValueFilter;
                goodValueCard.classList.toggle('active', this.goodValueFilter);
                this.filterItems();
            });
        }

        // Listen for storage changes to update dashboard
        chrome.storage.onChanged.addListener((changes) => {
            if (changes.analyzedItems) {
                this.loadItems().then(() => {
                    this.updateStats();
                    this.filterItems();
                });
            }
        });
    }

    async removeItem(identifier) {
        if (confirm('Are you sure you want to remove this item?')) {
            // Find item by ID or URL
            const itemIndex = this.items.findIndex(item =>
                item.id === identifier || item.url === identifier
            );

            if (itemIndex >= 0) {
                this.items.splice(itemIndex, 1);

                // Update storage
                await new Promise((resolve) => {
                    chrome.storage.local.set({ analyzedItems: this.items }, resolve);
                });

                // Update UI
                this.updateStats();
                this.filterItems();
            }
        }
    }

    computeDynamicPriceRanges(validItems) {
        const priceValues = validItems
            .map(item => this.normalizePriceValue(item.price))
            .filter(value => Number.isFinite(value) && value >= 0);

        if (priceValues.length === 0) {
            return [
                { label: '€0-10', count: 0 },
                { label: '€10-50', count: 0 },
                { label: '€50-100', count: 0 },
                { label: '€100+', count: 0 }
            ];
        }

        const bucketCount = 4;
        priceValues.sort((a, b) => a - b);

        const boundaries = [];
        for (let i = 0; i <= bucketCount; i++) {
            boundaries.push(this.getQuantileValue(priceValues, i / bucketCount));
        }

        for (let i = 1; i < boundaries.length; i++) {
            if (boundaries[i] < boundaries[i - 1]) {
                boundaries[i] = boundaries[i - 1];
            }
        }

        const counts = new Array(bucketCount).fill(0);
        priceValues.forEach(price => {
            for (let i = 0; i < bucketCount; i++) {
                const upper = boundaries[i + 1];
                if (i === bucketCount - 1 || price < upper || upper === boundaries[i]) {
                    counts[i]++;
                    break;
                }
            }
        });

        return counts.map((count, index) => ({
            label: this.buildRangeLabel(boundaries[index], boundaries[index + 1], index === bucketCount - 1),
            count
        }));
    }

    normalizePriceValue(price) {
        if (typeof price === 'number' && Number.isFinite(price)) {
            return price;
        }

        if (typeof price === 'string') {
            let normalized = price.replace(/[^0-9.,-]/g, '');
            if (!normalized) {
                return null;
            }

            // Remove thousands separators (dots) when followed by three digits
            normalized = normalized.replace(/\.(?=\d{3}(?:[.,]|$))/g, '');

            // If a comma exists and looks like a decimal separator, convert it
            const commaIndex = normalized.lastIndexOf(',');
            const dotIndex = normalized.lastIndexOf('.');
            if (commaIndex > dotIndex) {
                const decimals = normalized.slice(commaIndex + 1);
                if (decimals.length <= 2) {
                    normalized = normalized.replace(',', '.');
                } else {
                    normalized = normalized.replace(/,/g, '');
                }
            } else if (commaIndex !== -1 && dotIndex === -1) {
                // Single comma scenario without dots
                const decimals = normalized.slice(commaIndex + 1);
                if (decimals.length <= 2) {
                    normalized = normalized.replace(',', '.');
                } else {
                    normalized = normalized.replace(/,/g, '');
                }
            } else {
                normalized = normalized.replace(/,/g, '');
            }

            const value = parseFloat(normalized);
            return Number.isFinite(value) ? value : null;
        }

        return null;
    }

    getQuantileValue(sortedValues, quantile) {
        if (!sortedValues.length) {
            return 0;
        }

        const position = (sortedValues.length - 1) * quantile;
        const base = Math.floor(position);
        const rest = position - base;
        const lower = sortedValues[base];
        const upper = sortedValues[base + 1];

        if (upper !== undefined) {
            return lower + rest * (upper - lower);
        }

        return lower;
    }

    buildRangeLabel(start, end, isLastRange) {
        const startLabel = this.formatRangeValue(start);
        if (isLastRange) {
            return `${startLabel}+`;
        }

        const endLabel = this.formatRangeValue(end);
        return startLabel === endLabel ? startLabel : `${startLabel}–${endLabel}`;
    }

    formatRangeValue(value) {
        if (!Number.isFinite(value)) {
            return '€0';
        }

        const roundedValue = value >= 100 ? Math.round(value / 10) * 10 : Math.round(value);
        return `€${roundedValue.toLocaleString('de-DE')}`;
    }
}

// Initialize dashboard
const dashboard = new DashboardManager();