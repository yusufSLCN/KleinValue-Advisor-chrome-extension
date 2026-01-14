class DashboardManager {
    constructor() {
        this.items = [];
        this.filteredItems = [];
        this.searchQuery = '';
        this.filters = this.getDefaultFilters();
        this.initialize();
    }

    async initialize() {
        await this.loadItems();
        this.initializeFilterChips();
        this.setupEventListeners();
        this.filterItems();
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

    updateItemsCount() {
        const count = this.filteredItems.length;
        const total = this.items.length;
        const hasSearch = Boolean(this.searchQuery.trim());
        const hasFilters = this.hasActiveFilters();
        document.getElementById('items-count').textContent = hasSearch || hasFilters
            ? `${count} of ${total} items`
            : `${total} items`;
    }

    filterItems() {
        let filtered = [...this.items];

        // Apply search filter
        if (this.searchQuery.trim()) {
            const query = this.searchQuery.toLowerCase();
            filtered = filtered.filter((item) => {
                const matchesTitle = item.title?.toLowerCase().includes(query);
                const matchesLocation = item.location?.toLowerCase().includes(query);
                const matchesReasoning = item.estimation?.reasoning?.toLowerCase().includes(query);
                return Boolean(matchesTitle || matchesLocation || matchesReasoning);
            });
        }

        const priceMin = this.parseNumberInput(this.filters.price.min);
        const priceMax = this.parseNumberInput(this.filters.price.max);
        if (priceMin !== null || priceMax !== null) {
            filtered = filtered.filter((item) => {
                const priceValue = this.normalizePriceValue(item.price);
                if (priceValue === null) {
                    return false;
                }
                if (priceMin !== null && priceValue < priceMin) {
                    return false;
                }
                if (priceMax !== null && priceValue > priceMax) {
                    return false;
                }
                return true;
            });
        }

        const valueMin = this.parseNumberInput(this.filters.value.min);
        const valueMax = this.parseNumberInput(this.filters.value.max);
        if (valueMin !== null || valueMax !== null) {
            filtered = filtered.filter((item) => {
                const raw = item.estimation?.value;
                const aiValue = typeof raw === 'number' ? raw : this.normalizePriceValue(raw);
                if (!Number.isFinite(aiValue)) {
                    return false;
                }
                if (valueMin !== null && aiValue < valueMin) {
                    return false;
                }
                if (valueMax !== null && aiValue > valueMax) {
                    return false;
                }
                return true;
            });
        }

        if (this.filters.goodValueOnly) {
            filtered = filtered.filter((item) => this.isGoodValue(item));
        }

        const addedFrom = this.parseDateInput(this.filters.added.from);
        const addedTo = this.parseDateInput(this.filters.added.to, { endOfDay: true });
        if (addedFrom !== null || addedTo !== null) {
            filtered = filtered.filter((item) => {
                const analyzedTimestamp = this.getDateTimestamp(item.analyzedAt || item.analyzed_at);
                if (analyzedTimestamp === null) {
                    return false;
                }
                if (addedFrom !== null && analyzedTimestamp < addedFrom) {
                    return false;
                }
                if (addedTo !== null && analyzedTimestamp > addedTo) {
                    return false;
                }
                return true;
            });
        }

        const listingFrom = this.parseDateInput(this.filters.listed.from);
        const listingTo = this.parseDateInput(this.filters.listed.to, { endOfDay: true });
        if (listingFrom !== null || listingTo !== null) {
            filtered = filtered.filter((item) => {
                const listingTimestamp = this.getListingDateTimestamp(item);
                if (listingTimestamp === null) {
                    return false;
                }
                if (listingFrom !== null && listingTimestamp < listingFrom) {
                    return false;
                }
                if (listingTo !== null && listingTimestamp > listingTo) {
                    return false;
                }
                return true;
            });
        }

        this.filteredItems = filtered;
        this.updateItemsCount();
        this.renderItems();
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
        const sortedItems = [...this.filteredItems].sort((a, b) => {
            const tsB = this.getDateTimestamp(b.analyzedAt || b.analyzed_at);
            const tsA = this.getDateTimestamp(a.analyzedAt || a.analyzed_at);
            return (tsB || 0) - (tsA || 0);
        });

        sortedItems.forEach((item) => {
            const itemElement = this.createItemElement(item);
            container.appendChild(itemElement);
        });
    }

    createItemElement(item) {
        const div = document.createElement('div');
        div.className = 'item-card';

        const imageHtml =
            item.images && item.images.length > 0
                ? `<img src="${item.images[0]}" alt="${item.title}" class="item-image" onerror="this.style.display='none'">`
                : '<div class="item-image" style="display: flex; align-items: center; justify-content: center; color: #6c757d; font-size: 1.2em;">📷</div>';

        const reasoningText = item.estimation?.reasoning
            ? this.escapeHtml(item.estimation.reasoning)
            : 'No reasoning available';

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
                        <span>${this.formatDate(item.analyzedAt || item.analyzed_at)}</span>
                    </div>
                </div>
                <div class="price-comparison">
                    <div class="listing-price">
                        💰 Listed: ${this.formatEuroDisplay(item.price)}
                    </div>
                    <div class="estimation">
                        ${
                            item.estimation?.error
                                ? `❌ Analysis Failed: ${item.estimation.errorMessage || 'Unknown error'}`
                                : `🤖 AI Estimate: ${this.formatEuroDisplay(item.estimation?.value)}`
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
                        <span>&times;</span>
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
                tooltip.style.left =
                    estimateRect.left - cardRect.left + estimateRect.width / 2 + 'px';
                tooltip.style.top =
                    estimateRect.top - cardRect.top - tooltip.offsetHeight - 8 + 'px';
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
        const listingPriceValue =
            typeof item.price === 'number' ? item.price : this.normalizePriceValue(item.price);
        const listingPrice = Number.isFinite(listingPriceValue) ? listingPriceValue : 0;
        const estimateValue =
            typeof item.estimation?.value === 'number'
                ? item.estimation.value
                : this.normalizePriceValue(item.estimation?.value);
        const estimate = Number.isFinite(estimateValue) ? estimateValue : 0;
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
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatEuroDisplay(value) {
        const numeric = this.normalizePriceValue(value);
        if (numeric === null || typeof numeric !== 'number') {
            return 'N/A';
        }
        return `${this.getEuroFormatter({ minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(numeric)} €`;
    }

    getEuroFormatter(options = {}) {
        if (!this.euroFormatterCache) {
            this.euroFormatterCache = new Map();
        }
        const { minimumFractionDigits = 2, maximumFractionDigits = 2 } = options;
        const cacheKey = `${minimumFractionDigits}-${maximumFractionDigits}`;
        if (!this.euroFormatterCache.has(cacheKey)) {
            this.euroFormatterCache.set(
                cacheKey,
                new Intl.NumberFormat('de-DE', {
                    minimumFractionDigits,
                    maximumFractionDigits
                })
            );
        }
        return this.euroFormatterCache.get(cacheKey);
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.filterItems();
            });
        }

        const filterSelect = document.getElementById('filter-add-select');
        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => {
                const filterKey = e.target.value;
                if (!filterKey) {
                    return;
                }
                this.activateFilter(filterKey);
                e.target.value = '';
            });
        }

        document.querySelectorAll('.chip-remove').forEach((button) => {
            button.addEventListener('click', () => {
                const filterKey = button.dataset.filterRemove;
                if (filterKey) {
                    this.deactivateFilter(filterKey);
                }
            });
        });

        const bindInput = (id, handler, eventName = 'input') => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener(eventName, handler);
            }
        };

        bindInput('price-min', (e) => {
            this.filters.price.min = e.target.value;
            this.filterItems();
        });

        bindInput('price-max', (e) => {
            this.filters.price.max = e.target.value;
            this.filterItems();
        });

        bindInput('value-min', (e) => {
            this.filters.value.min = e.target.value;
            this.filterItems();
        });

        bindInput('value-max', (e) => {
            this.filters.value.max = e.target.value;
            this.filterItems();
        });

        bindInput('added-after', (e) => {
            this.filters.added.from = e.target.value;
            this.filterItems();
        }, 'change');

        bindInput('added-before', (e) => {
            this.filters.added.to = e.target.value;
            this.filterItems();
        }, 'change');

        bindInput('listing-after', (e) => {
            this.filters.listed.from = e.target.value;
            this.filterItems();
        }, 'change');

        bindInput('listing-before', (e) => {
            this.filters.listed.to = e.target.value;
            this.filterItems();
        }, 'change');

        const goodValueToggle = document.getElementById('good-value-only');
        if (goodValueToggle) {
            goodValueToggle.addEventListener('change', (e) => {
                this.filters.goodValueOnly = e.target.checked;
                this.filterItems();
            });
        }

        const clearFiltersBtn = document.getElementById('clear-filters');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => this.resetFilters());
        }

        // Listen for storage changes to update dashboard
        chrome.storage.onChanged.addListener((changes) => {
            if (changes.analyzedItems) {
                this.loadItems().then(() => {
                    this.filterItems();
                });
            }
        });
    }

    async removeItem(identifier) {
        if (confirm('Are you sure you want to remove this item?')) {
            // Find item by ID or URL
            const itemIndex = this.items.findIndex(
                (item) => item.id === identifier || item.url === identifier
            );

            if (itemIndex >= 0) {
                this.items.splice(itemIndex, 1);

                // Update storage
                await new Promise((resolve) => {
                    chrome.storage.local.set({ analyzedItems: this.items }, resolve);
                });

                // Update UI
                this.filterItems();
            }
        }
    }

    getDefaultFilters() {
        return {
            price: { min: '', max: '' },
            value: { min: '', max: '' },
            added: { from: '', to: '' },
            listed: { from: '', to: '' },
            goodValueOnly: false
        };
    }

    initializeFilterChips() {
        ['price', 'value', 'goodValue', 'added', 'listing'].forEach((filterKey) => {
            this.setFilterChipActive(filterKey, false);
        });
    }

    activateFilter(filterKey) {
        const isAlreadyActive = this.isFilterChipActive(filterKey);
        if (isAlreadyActive) {
            return;
        }

        this.setFilterChipActive(filterKey, true);
        if (filterKey === 'goodValue') {
            const goodValueToggle = document.getElementById('good-value-only');
            if (goodValueToggle) {
                goodValueToggle.checked = true;
            }
            this.filters.goodValueOnly = true;
        }
        this.filterItems();
    }

    deactivateFilter(filterKey) {
        this.setFilterChipActive(filterKey, false);
        this.filterItems();
    }

    isFilterChipActive(filterKey) {
        const chip = this.getFilterChip(filterKey);
        return Boolean(chip && chip.classList.contains('active'));
    }

    setFilterChipActive(filterKey, isActive) {
        const chip = this.getFilterChip(filterKey);
        if (!chip) {
            return;
        }

        chip.classList.toggle('active', isActive);
        chip.setAttribute('aria-hidden', String(!isActive));

        chip.querySelectorAll('input').forEach((input) => {
            input.disabled = !isActive;
            if (!isActive) {
                if (input.type === 'checkbox') {
                    input.checked = false;
                } else {
                    input.value = '';
                }
            }
        });

        if (!isActive) {
            this.clearFilterState(filterKey);
        }
    }

    clearFilterState(filterKey) {
        switch (filterKey) {
            case 'price':
                this.filters.price.min = '';
                this.filters.price.max = '';
                break;
            case 'value':
                this.filters.value.min = '';
                this.filters.value.max = '';
                break;
            case 'added':
                this.filters.added.from = '';
                this.filters.added.to = '';
                break;
            case 'listing':
                this.filters.listed.from = '';
                this.filters.listed.to = '';
                break;
            case 'goodValue':
                this.filters.goodValueOnly = false;
                break;
            default:
                break;
        }
    }

    getFilterChip(filterKey) {
        return document.querySelector(`.filter-chip[data-filter="${filterKey}"]`);
    }

    resetFilters() {
        this.filters = this.getDefaultFilters();
        ['price', 'value', 'goodValue', 'added', 'listing'].forEach((filterKey) => {
            this.setFilterChipActive(filterKey, false);
        });
        this.filterItems();
    }

    hasActiveFilters() {
        const { price, value, added, listed, goodValueOnly } = this.filters;
        return (
            goodValueOnly ||
            price.min !== '' ||
            price.max !== '' ||
            value.min !== '' ||
            value.max !== '' ||
            added.from !== '' ||
            added.to !== '' ||
            listed.from !== '' ||
            listed.to !== ''
        );
    }

    parseNumberInput(value) {
        if (value === '' || value === null || value === undefined) {
            return null;
        }
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : null;
    }

    parseDateInput(value, { endOfDay = false } = {}) {
        if (!value) {
            return null;
        }
        const date = new Date(`${value}T00:00:00`);
        if (Number.isNaN(date.getTime())) {
            return null;
        }
        if (endOfDay) {
            date.setHours(23, 59, 59, 999);
        }
        return date.getTime();
    }

    getDateTimestamp(rawValue) {
        if (!rawValue) {
            return null;
        }
        const date = new Date(rawValue);
        const timestamp = date.getTime();
        return Number.isNaN(timestamp) ? null : timestamp;
    }

    getListingDateTimestamp(item) {
        const candidate =
            item.listingDate ||
            item.listing_date ||
            item.listedAt ||
            item.posting_time ||
            item.postingTime ||
            item.metadata?.listingDate;
        return this.getDateTimestamp(candidate);
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
}

// Initialize dashboard
const dashboard = new DashboardManager();
