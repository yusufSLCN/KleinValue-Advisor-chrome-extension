/**
 * Content script for Kleinanzeigen AI Analyzer
 * Injects AI analysis button on item pages and extracts item data
 */

// Libraries are now imported as ES modules

// Global analyzer instance
let analyzer = null;

// Initialize analyzer when API key is available
async function initializeAnalyzer() {
    try {
        const apiKey = await window.StorageManager.getApiKey();
        if (apiKey) {
            analyzer = await window.getEstimator();
        }
    } catch (error) {
        if (!error.message.includes('Extension context invalidated')) {
            console.error('Failed to initialize AI analyzer:', error);
        }
    }
}

// Wait for page to load
document.addEventListener('DOMContentLoaded', function() {
    initializeAnalyzer();
    injectAIAnalysisButton();
});

// Also run immediately in case DOM is already loaded
if (document.readyState !== 'loading') {
    initializeAnalyzer();
    injectAIAnalysisButton();
}

// Also run if DOM changes (for dynamic content)
const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
        if (mutation.type === 'childList') {
            injectAIAnalysisButton();
        }
    });
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

async function showExistingEstimation(titleElement, estimation) {
    // Check if we already added this - remove to avoid duplicates
    const existing = document.getElementById('ai-estimate-container');
    if (existing) {
        existing.remove();
    }
    
    // Find the price element (same logic as injectAIEstimate)
    const priceSelectors = [
        '.ad-price',
        '[data-qa="price"]',
        '.price',
        '.aditem-price',
        '[class*="price"]'
    ];

    let priceElement = null;
    for (const selector of priceSelectors) {
        priceElement = document.querySelector(selector);
        if (priceElement) break;
    }

    if (!priceElement) {
        return;
    }

    // Get settings
    let settings = { confidenceThreshold: 70 };
    try {
        settings = await window.StorageManager.getSettings();
    } catch (e) {
        console.warn('Could not load settings:', e);
    }

    const value = estimation.value;
    const reasoning = estimation.reasoning;
    const confidence = estimation.confidence || 70;
    const threshold = settings.confidenceThreshold || 70;
    const cost = estimation.estimatedCost;
    const isError = estimation.error === true;

    // Create compact AI estimate badge
    const estimateContainer = document.createElement('div');
    estimateContainer.id = 'ai-estimate-container';
    estimateContainer.style.cssText = `
        display: inline-block;
        margin-left: 15px;
        padding: 6px 12px;
        background: linear-gradient(135deg, #f0f8ff 0%, #e1f0ff 100%);
        border: 2px solid #2196F3;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 600;
        color: #1a1a1a;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
    `;
    
    const summaryText = document.createElement('div');
    summaryText.innerHTML = `🤖 €${value !== null && value !== undefined ? value.toFixed(0) : 'N/A'} <span style="font-size: 10px;">▼</span>`;
    estimateContainer.appendChild(summaryText);
    
    // Create floating details panel
    const detailsPanel = document.createElement('div');
    detailsPanel.className = 'ai-details-panel';
    detailsPanel.style.cssText = `
        display: none;
        position: fixed;
        padding: 16px;
        background: white;
        border: 2px solid #2196F3;
        border-radius: 12px;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
        z-index: 10000;
        min-width: 400px;
        max-width: 550px;
        font-size: 13px;
        font-weight: normal;
        line-height: 1.6;
        color: #2d2d2d;
    `;
    detailsPanel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 2px solid #e9ecef;">
            <div>
                <strong style="font-size: 18px; color: #2196F3;">AI Estimate: €${value !== null && value !== undefined ? value.toFixed(2) : 'N/A'}</strong>
                <div style="font-size: 12px; color: #6c757d; margin-top: 4px;">Confidence: ${confidence}%</div>
            </div>
        </div>
        <div style="margin-bottom: 12px;">
            <strong style="color: #495057; font-size: 14px;">Reasoning:</strong>
            <div style="margin-top: 6px; color: #495057; line-height: 1.5;">${reasoning || 'No reasoning provided'}</div>
        </div>
        <div style="padding-top: 10px; border-top: 1px solid #e9ecef; font-size: 11px; color: #6c757d;">
            ${estimation.model ? `<div style="margin-bottom: 4px;"><strong>Model:</strong> ${estimation.model}</div>` : ''}
            ${!isError && cost ? `<div><strong>API Cost:</strong> ${cost.formatted} (${cost.totalTokens} tokens)</div>` : ''}
        </div>
    `;
    
    document.body.appendChild(detailsPanel);
    
    let expanded = false;
    estimateContainer.addEventListener('click', function(e) {
        e.stopPropagation();
        expanded = !expanded;
        if (expanded) {
            const rect = estimateContainer.getBoundingClientRect();
            detailsPanel.style.display = 'block';
            detailsPanel.style.top = (rect.bottom + 8) + 'px';
            detailsPanel.style.left = Math.max(10, rect.left) + 'px';
            summaryText.querySelector('span:last-child').textContent = '▲';
            estimateContainer.style.background = 'linear-gradient(135deg, #d4edff 0%, #c1e4ff 100%)';
        } else {
            detailsPanel.style.display = 'none';
            summaryText.querySelector('span:last-child').textContent = '▼';
            estimateContainer.style.background = 'linear-gradient(135deg, #f0f8ff 0%, #e1f0ff 100%)';
        }
    });
    
    // Close when clicking outside
    document.addEventListener('click', function(e) {
        if (!estimateContainer.contains(e.target) && !detailsPanel.contains(e.target) && expanded) {
            expanded = false;
            detailsPanel.style.display = 'none';
            summaryText.querySelector('span:last-child').textContent = '▼';
            estimateContainer.style.background = 'linear-gradient(135deg, #f0f8ff 0%, #e1f0ff 100%)';
        }
    });

    // Insert inline next to price
    priceElement.style.display = 'flex';
    priceElement.style.alignItems = 'center';
    priceElement.style.flexWrap = 'wrap';
    priceElement.appendChild(estimateContainer);
}

function injectAIAnalysisButton() {
    // Check if button already exists
    if (document.getElementById('ai-analyze-button')) {
        return;
    }

    // Find the ad title container (typically h1 or .ad-titles)
    const titleElement = document.querySelector('h1.adtitle') || document.querySelector('.ad-titles h1') || document.querySelector('h1');
    
    if (!titleElement) {
        return; // Not on an item page
    }

    // Create button
    const button = document.createElement('button');
    button.id = 'ai-analyze-button';
    button.innerHTML = '&#129302; Analyze with AI';
    button.style.cssText = `
        background: linear-gradient(45deg, #007bff, #0056b3);
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 20px;
        cursor: pointer;
        font-size: 14px;
        margin-left: 10px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        transition: all 0.2s;
    `;

    button.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-1px)';
        this.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
    });

    button.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    });

    // Check if this item has already been analyzed and update button accordingly
    const pageUrl = window.location.href;
    window.StorageManager.getItems().then(items => {
        const existingItem = items.find(item => item.url === pageUrl);

        if (existingItem && existingItem.estimation && !existingItem.estimation.error) {
            // Item has been analyzed before - update button text and style
            button.innerHTML = '&#128257; Re-analyze';
            button.style.background = 'linear-gradient(45deg, #28a745, #1e7e34)';
            button.title = 'This item has already been analyzed. Click to re-analyze.';
            
            // Show the existing AI estimation
            showExistingEstimation(titleElement, existingItem.estimation);
        }
    }).catch(error => {
        if (error.message.includes('Extension context invalidated')) {
            console.log('Extension reloaded, using default button state');
        } else {
            console.error('Error checking button state:', error);
        }
    });

    // Append button next to title
    titleElement.parentNode.insertBefore(button, titleElement.nextSibling);

    // Extract item data and attach to button for click handler
    const itemData = extractItemData();
    button.itemData = itemData;

    // Add click handler to perform AI analysis
    button.addEventListener('click', async function() {
        if (!this.itemData) {
            console.error('❌ Item data not available');
            return;
        }

        // Check if analyzer is initialized
        if (!analyzer) {
            let apiKey = null;
            try {
                apiKey = await window.StorageManager.getApiKey();
            } catch (error) {
                if (error && error.message && error.message.includes('Extension context invalidated')) {
                    console.log('Extension context invalidated during API key fetch; prompting user to retry');
                    alert('The extension was reloaded. Please click Analyze again.');
                    return;
                } else {
                    console.error('Failed to read API key:', error);
                    alert('Failed to read API key from extension storage.');
                    return;
                }
            }

            if (!apiKey) {
                alert('Please configure your Gemini API key in the extension settings first.');
                return;
            }

            try {
                analyzer = await window.getEstimator();
            } catch (error) {
                console.error('Failed to initialize analyzer:', error);
                alert('Failed to initialize AI analyzer. Please check your API key.');
                return;
            }
        }

        // Disable button and show loading
        this.disabled = true;
        this.innerHTML = '&#128257; Analyzing...';

        try {
            // Perform direct AI analysis
            const estimation = await analyzer.estimateValue(this.itemData);

            // Add estimation to item data
            this.itemData.estimation = estimation;
            this.itemData.analyzed_at = new Date().toISOString();

            // Save to chrome.storage.local
            try {
                await window.StorageManager.saveItem(this.itemData, estimation);
            } catch (error) {
                if (error.message.includes('Extension context invalidated')) {
                    console.log('Extension reloaded during save, item not saved');
                } else {
                    throw error;
                }
            }

            // Show success and keep as re-analyze
            this.innerHTML = '&#9989; Analyzed!';
            setTimeout(() => {
                this.innerHTML = '&#128257; Re-analyze';
                this.disabled = false;
            }, 2000);

            // Inject AI estimate next to the real price
            injectAIEstimate(estimation);

        } catch (error) {
            console.error('Analysis error:', error);
            if (error.message.includes('API key not configured')) {
                alert('Please configure your Gemini API key in the extension settings.');
            } else {
                console.error('❌ Analysis failed:', error.message);
                // Create error estimation object
                const errorEstimation = {
                    error: true,
                    errorMessage: error.message || 'Unknown error occurred',
                    value: null,
                    reasoning: 'Analysis failed - please check your API key and try again',
                    confidence: 0,
                    model: 'error'
                };
                this.itemData.estimation = errorEstimation;
                this.itemData.analyzed_at = new Date().toISOString();

                try {
                    await window.StorageManager.saveItem(this.itemData, errorEstimation);
                } catch (saveError) {
                    if (saveError.message.includes('Extension context invalidated')) {
                        console.log('Extension reloaded during error save, item not saved');
                    } else {
                        console.error('Error saving error estimation:', saveError);
                    }
                }
                injectAIEstimate(errorEstimation);
            }
            this.innerHTML = '&#128257; Re-analyze';
            this.disabled = false;
        }
    });
}

function extractItemData() {
    // Try to extract data from JSON-LD structured data first (most reliable)
    let structuredData = null;

    // Look for JSON-LD in the main product section first
    const mainSection = document.querySelector('#viewad-main');
    if (mainSection) {
        const jsonLdScript = mainSection.querySelector('script[type="application/ld+json"]');
        if (jsonLdScript) {
            try {
                structuredData = JSON.parse(jsonLdScript.textContent);
            } catch (e) {
                // Silently ignore JSON parsing errors
            }
        }
    }

    // Fallback to page-level JSON-LD if not found in main section
    if (!structuredData) {
        const jsonLdScript = document.querySelector('script[type="application/ld+json"]');
        if (jsonLdScript) {
            try {
                structuredData = JSON.parse(jsonLdScript.textContent);
            } catch (e) {
                // Silently ignore JSON parsing errors
            }
        }
    }

    // Extract title - prefer structured data, fallback to DOM
    let title = '';
    if (structuredData && structuredData.title) {
        title = structuredData.title;
    } else {
        title = (document.querySelector('h1.adtitle') ||
                  document.querySelector('.ad-titles h1') ||
                  document.querySelector('h1') ||
                  document.querySelector('[data-qa="ad-title"]'))?.textContent?.trim() || '';
    }

    // Clean up title by removing status indicators
    title = title.replace(/^(Reserviert|Gelöscht|Verfügbar|Online|Offline)\s*[•·]\s*/gi, '').trim();
    // Also remove any remaining status text at the beginning
    title = title.replace(/^(Gelöscht|Reserviert|Verfügbar)\s*/gi, '').trim();
    // Remove any remaining bullet points or special characters at the start
    title = title.replace(/^[\s•·\-]+\s*/g, '').trim();
    // Clean up extra whitespace and normalize
    title = title.replace(/\s+/g, ' ').trim();
    // Keep only essential logs

    // Extract description - prefer structured data, fallback to DOM
    let description = '';
    if (structuredData && structuredData.description) {
        description = structuredData.description;
    } else {
        const descSelectors = [
            '#ad-description',
            '.ad-description',
            '[data-qa="description"]',
            '.aditem-description',
            '.description',
            '[class*="description"]',
            '.ad-description-text',
            '.description-text'
        ];

        // First try to get description from the main product section
        const mainSectionDesc = document.querySelector('#viewad-main #viewad-description-text');
        if (mainSectionDesc) {
            description = mainSectionDesc.textContent || mainSectionDesc.innerText || '';
            description = description.trim();
            description = description.replace(/\s+/g, ' ');
            description = description.replace(/\n+/g, ' ');

            // Description extracted successfully
        }

        // Fallback to other selectors if main section didn't work
        if (!description || description.length <= 10) {
            for (const selector of descSelectors) {
                const element = document.querySelector(selector);
                if (element) {
                    // Get all text content including nested elements
                    description = element.textContent || element.innerText || '';
                    description = description.trim();

                    // Remove excessive whitespace and newlines
                    description = description.replace(/\s+/g, ' ');
                    description = description.replace(/\n+/g, ' ');

                    if (description && description.length > 10) { // Ensure we have meaningful content
                        console.log('📝 Description from fallback selector:', description);
                        break;
                    }
                }
            }
        }
    }

    // Try to extract additional product details from specifications
    const productDetails = extractProductDetails();
    if (productDetails) {
        description += '\n\n' + productDetails;
    }

    // Keep only essential logs

    // Extract location - try multiple selectors with better specificity
    let location = 'Unknown';
    const locationSelectors = [
        // Kleinanzeigen specific selectors - most accurate first
        '#viewad-locality', // From HTML source: <span id="viewad-locality" itemprop="locality">
        '.l-adinfo-address',
        '[data-qa="ad-location"]',
        '.ad-location',
        '.location',
        '[class*="location"]',
        '.adinfo-address',
        '.ad-details-location',
        '.location-info',
        '.ad-address',
        '.address',
        // More specific selectors
        '.adinfo-location',
        '.location-text',
        '.ad-location-text',
        '.address-line',
        // Try broader selectors
        '[class*="address"]',
        '[class*="ort"]', // German for location/place
        '[class*="stadt"]', // German for city
        // Try to find location in structured data or meta tags
        'meta[property="og:location"]',
        'meta[name="location"]',
        'meta[property="place:location"]',
        // Try JSON-LD structured data
        'script[type="application/ld+json"]'
    ];

    for (const selector of locationSelectors) {
        const element = document.querySelector(selector);
        if (element) {
            let extractedLocation = '';
            if (element.tagName === 'META') {
                extractedLocation = element.getAttribute('content') || '';
            } else if (element.tagName === 'SCRIPT' && element.type === 'application/ld+json') {
                // Try to extract from JSON-LD
                try {
                    const jsonData = JSON.parse(element.textContent);
                    if (jsonData.location && jsonData.location.address) {
                        extractedLocation = jsonData.location.address.addressLocality ||
                                          jsonData.location.address.addressRegion ||
                                          jsonData.location.address.addressCountry || '';
                    }
                } catch (e) {
                    // Silently ignore JSON parsing errors
                }
            } else {
                extractedLocation = element.textContent.trim();
            }

            // Clean up the location text
            if (extractedLocation) {
                // Remove common prefixes
                extractedLocation = extractedLocation.replace(/^(Standort|Location|Adresse|Ort|Stadt):\s*/i, '');
                // More aggressive location cleaning
                extractedLocation = extractedLocation.split('\n')[0]; // Take only first line
                extractedLocation = extractedLocation.split('Bei Interesse')[0]; // Remove contact text
                extractedLocation = extractedLocation.split('Melden')[0]; // Remove contact text
                extractedLocation = extractedLocation.split('Kontakt')[0]; // Remove contact text
                extractedLocation = extractedLocation.split('Anzeige')[0]; // Remove ad text
                extractedLocation = extractedLocation.split('Verkauf')[0]; // Remove sale text
                extractedLocation = extractedLocation.split('Preis')[0]; // Remove price text
                extractedLocation = extractedLocation.split('Telefon')[0]; // Remove phone text
                extractedLocation = extractedLocation.split('Email')[0]; // Remove email text

                // Remove postal codes and numbers at the beginning
                extractedLocation = extractedLocation.replace(/^\d+\s*/, '');

                // Remove any remaining non-location text patterns
                extractedLocation = extractedLocation.replace(/[^\w\säöüÄÖÜß\-]/g, ''); // Remove special chars except German umlauts
                extractedLocation = extractedLocation.trim();

                // Final cleanup - remove any remaining unwanted words
                const unwantedWords = ['Bei', 'Interesse', 'einfach', 'melden', 'kontakt', 'anzeige', 'verkauf', 'preis', 'telefon', 'email', 'wird', 'ist', 'hat', 'der', 'die', 'das', 'und', 'oder', 'mit', 'auf', 'für', 'von', 'zu', 'im', 'am', 'um', 'aus'];
                extractedLocation = extractedLocation.split(' ').filter(word => !unwantedWords.includes(word.toLowerCase())).join(' ');

                extractedLocation = extractedLocation.trim();

                // If location is too long or contains too many words, take only the first meaningful part
                if (extractedLocation.length > 50 || extractedLocation.split(' ').length > 4) {
                    extractedLocation = extractedLocation.split(' ').slice(0, 3).join(' ');
                }
                // Remove extra whitespace
                extractedLocation = extractedLocation.replace(/\s+/g, ' ').trim();
                // Skip if it's just generic text
                if (extractedLocation &&
                    !extractedLocation.includes('Kleinanzeigen') &&
                    !extractedLocation.includes('eBay') &&
                    !extractedLocation.includes('Anzeige') &&
                    !extractedLocation.includes('Verkauf') &&
                    extractedLocation.length > 2 &&
                    extractedLocation !== 'Unknown') {
                    location = extractedLocation;
    // Keep only essential logs
                    break;
                }
            }
        }
    }

    // Try to extract from URL if still unknown
    if (location === 'Unknown') {
        const url = window.location.href;
        // Look for location in URL parameters
        const urlMatch = url.match(/[?&]location=([^&]+)/);
        if (urlMatch) {
            location = decodeURIComponent(urlMatch[1]);
        }
    }

    // Try to find location in page text content as last resort
    if (location === 'Unknown') {
        const bodyText = document.body.textContent || '';
        // Look for common location patterns in the page text
        const locationPatterns = [
            /Standort:\s*([^\n\r,]+)/i,
            /Ort:\s*([^\n\r,]+)/i,
            /Stadt:\s*([^\n\r,]+)/i,
            /Location:\s*([^\n\r,]+)/i
        ];

        for (const pattern of locationPatterns) {
            const match = bodyText.match(pattern);
            if (match && match[1]) {
                const potentialLocation = match[1].trim();
                if (potentialLocation.length > 2 &&
                    !potentialLocation.includes('Kleinanzeigen') &&
                    !potentialLocation.includes('eBay')) {
                    location = potentialLocation;
                    break;
                }
            }
        }
    }

    // Keep only essential logs

    // Extract price - try multiple selectors
    let price = null;
    const priceSelectors = [
        '.ad-price',
        '[data-qa="price"]',
        '.price',
        '.aditem-price',
        '[class*="price"]'
    ];

    for (const selector of priceSelectors) {
        const element = document.querySelector(selector);
        if (element) {
            const priceText = element.textContent.trim();
    // Keep only essential logs
            if (priceText) {
                // Handle German price format: "123,45 €" or "2.200 €" or "Preis: 123,45 €"
                let cleanPrice = priceText.replace(/€/g, '').replace(/EUR/gi, '').trim();

                // Remove prefixes like "Preis:", "Price:", etc.
                cleanPrice = cleanPrice.replace(/^(Preis|Price|Kosten):\s*/i, '');

        // Keep only essential logs

                // Handle German number format:
                // - Decimal separator: comma (,)
                // - Thousands separator: dot (.)
                // Examples: "2.200 €" = 2200, "123,45 €" = 123.45, "1.234,56 €" = 1234.56

                // First, extract just the number part from the text (ignore extra text like "VB")
                const numberMatch = cleanPrice.match(/(\d+(?:\.\d{3})*(?:,\d{2})?)/);
                if (numberMatch) {
                    let numberPart = numberMatch[1];
            // Keep only essential logs

                    // Check if this is a German format with thousands separator
                    // Pattern: digits with dots (thousands) followed by comma and 2 digits (decimal)
                    const germanThousandsMatch = numberPart.match(/^(\d+(?:\.\d{3})*),\d{2}$/);
                    if (germanThousandsMatch) {
                        // German format with decimals: "1.234,56" -> "1234.56"
                        numberPart = numberPart.replace(/\./g, '').replace(',', '.');
                // Keep only essential logs
                    } else {
                        // Check if this is just thousands without decimals: "2.200"
                        const thousandsOnlyMatch = numberPart.match(/^(\d+(?:\.\d{3})*)$/);
                        if (thousandsOnlyMatch && numberPart.includes('.')) {
                            // Remove thousands separators: "2.200" -> "2200"
                            numberPart = numberPart.replace(/\./g, '');
                        } else if (numberPart.includes(',')) {
                            // Handle comma as decimal: "123,45" -> "123.45"
                            numberPart = numberPart.replace(',', '.');
                        }
                    }

                    price = parseFloat(numberPart);
            // Keep only essential logs
                    break;
                }
            }
        }
    }
    // Keep only essential logs

    // Extract images - prioritize JSON-LD structured data from gallery elements
    let images = [];

    // First, try to extract from JSON-LD structured data in gallery elements (most reliable)
    const galleryElements = document.querySelectorAll('.galleryimage-element');

    for (const galleryEl of galleryElements) {
        const jsonLdScript = galleryEl.querySelector('script[type="application/ld+json"]');
        if (jsonLdScript) {
            try {
                const imageData = JSON.parse(jsonLdScript.textContent);
                if (imageData.contentUrl && imageData.contentUrl.startsWith('http')) {
                    images.push(imageData.contentUrl);
                }
            } catch (e) {
                // Silently ignore JSON parsing errors
            }
        }
    }

    // If no images from JSON-LD, fallback to img elements
    if (images.length === 0) {
        // Find the main ad container first (like monitor app finds item element)
        const adContainer = document.querySelector('#viewad-main') ||
                            document.querySelector('.ad-view') ||
                            document.querySelector('.ad-details') ||
                            document.querySelector('[data-testid="ad-details"]') ||
                            document.body;

        try {
            // Find all img elements within the ad container (like monitor app does)
            const imgElements = adContainer.querySelectorAll('img');

            for (const img of Array.from(imgElements).slice(0, 5)) { // Check more images
                // Check both src and data-imgsrc (for lazy loading)
                let src = img.src || img.getAttribute('src') || img.getAttribute('data-imgsrc') || img.getAttribute('data-src');

                // Skip if no src or if it's an icon/logo/placeholder
                if (!src || !src.startsWith('http') || src.includes('placeholder') || src.includes('icon') || src.includes('logo')) {
                    continue;
                }

                // Skip very small images (likely icons)
                if (img.width && img.width < 100) continue;
                if (img.height && img.height < 100) continue;

                // Skip images that are not in the main content area
                const rect = img.getBoundingClientRect();
                if (rect.width < 200 || rect.height < 200) continue;

                images.push(src);
            }

            // If still no images found, try looking for gallery elements specifically
            if (images.length === 0) {
                const gallerySelectors = [
                    '.galleryimage-element img',
                    '.gallery img',
                    '.ad-gallery img',
                    '.image-gallery img',
                    '[class*="gallery"] img'
                ];

                for (const selector of gallerySelectors) {
                    const galleryImgs = document.querySelectorAll(selector);

                    for (const img of Array.from(galleryImgs).slice(0, 5)) {
                        let src = img.src || img.getAttribute('src') || img.getAttribute('data-imgsrc') || img.getAttribute('data-src');

                        if (src && src.startsWith('http') && !src.includes('placeholder') && !src.includes('icon') && !src.includes('logo')) {
                            images.push(src);
                        }
                    }

                    if (images.length > 0) break;
                }
            }

        } catch (e) {
            console.warn('Error extracting images:', e);
        }
    }

    // Keep only essential logs

    // Get current URL
    const url = window.location.href;
    // Keep only essential logs

    // Get posting time - try multiple selectors
    let postingTime = new Date().toISOString();
    const timeSelectors = [
        '[data-qa="posted-date"]',
        '.ad-date',
        '.posted-date',
        '.date',
        '[class*="date"]'
    ];

    for (const selector of timeSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim()) {
            // For now, use current time - can be improved with German time parsing
            break;
        }
    }
    // Keep only essential logs

    // If we have minimal data, provide fallback description
    if (!description && title) {
        description = `Item: ${title}. Location: ${location}. ${price ? `Price: €${price}` : 'Price not specified.'}`;
    }

    const itemData = {
        title: title,
        description: description,
        location: location,
        price: price,
        images: images,
        url: url,
        posting_time: postingTime
    };

    // Data extraction completed

    return itemData;
}

function extractProductDetails() {
    const details = [];

    // Try to find product specification tables or structured data - Kleinanzeigen specific
    const specSelectors = [
        // Primary Kleinanzeigen selectors based on debug output
        '.addetailslist',
        '.addetailslist--detail',
        '.addetailslist--split',
        // Fallback selectors
        '.ad-details',
        '.ad-specifications',
        '.product-details',
        '.item-details',
        '.specifications',
        '[class*="detail"]',
        '[class*="spec"]',
        'table',
        '.ad-attributes',
        '.attributes',
        // Kleinanzeigen specific selectors
        '.attribute-list',
        '.ad-description-details',
        '.key-value-list',
        '.spec-list',
        '.product-specs',
        '.item-specs',
        '.ad-properties',
        '.properties',
        // Try to find structured data containers
        '[data-testid*="attribute"]',
        '[data-qa*="attribute"]',
        '.ad-attribute',
        '.attribute-item',
        // More specific Kleinanzeigen patterns
        '.aditem-details',
        '.product-information',
        '.item-information',
        '.specifications-table',
        '.details-table'
    ];

    // First, try to extract from the specific Kleinanzeigen structure
    const detailElements = document.querySelectorAll('.addetailslist--detail');

    for (const detailElement of detailElements) {
        const text = detailElement.textContent || '';

        // Split by newlines to separate key and value
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);

        if (lines.length >= 2) {
            const key = lines[0];
            const value = lines.slice(1).join(' ').trim();

    // Keep only essential logs

            if (key && value && key.length < 50 && value.length < 100) {
                // Map German keys to English labels - generic product attributes
                const keyMapping = {
                    'Marke': 'Brand',
                    'Modell': 'Model',
                    'Größe': 'Size',
                    'Zustand': 'Condition',
                    'Farbe': 'Color',
                    'Material': 'Material',
                    'Gewicht': 'Weight',
                    'Art': 'Type',
                    'Ausstattung': 'Features',
                    'Leistung': 'Power',
                    'Kapazität': 'Capacity',
                    'Anzahl': 'Quantity',
                    'Packung': 'Package',
                    'Hersteller': 'Manufacturer',
                    'Typ': 'Type',
                    'Maße': 'Dimensions',
                    'Status': 'Status',
                    'Materialien': 'Materials',
                    'Performance': 'Performance',
                    'Volume': 'Volume',
                    'Count': 'Count',
                    'Pieces': 'Pieces',
                    'Set': 'Set'
                };

                const englishKey = keyMapping[key] || key;
                if (!details.some(d => d.includes(englishKey))) {
                    details.push(`${englishKey}: ${value}`);
                }
            }
        }
    }

    // Fallback to other selectors if no structured data found
    if (details.length === 0) {
    // Keep only essential logs
        for (const selector of specSelectors) {
            if (selector === '.addetailslist' || selector === '.addetailslist--detail' || selector === '.addetailslist--split') {
                continue; // Already tried these
            }

            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
                // Look for key-value pairs in the element
                const text = element.textContent || element.innerText || '';

                // Extract common product attributes - generic patterns
                const attributes = [
                    { pattern: /(?:Marke|Brand|Hersteller|Manufacturer):\s*([^\n\r,]+)/i, label: 'Brand' },
                    { pattern: /(?:Modell|Model|Typ|Type):\s*([^\n\r,]+)/i, label: 'Model' },
                    { pattern: /(?:Größe|Size|Maße|Dimensions):\s*([^\n\r,]+)/i, label: 'Size' },
                    { pattern: /(?:Zustand|Condition|Status):\s*([^\n\r,]+)/i, label: 'Condition' },
                    { pattern: /(?:Farbe|Color|Colour):\s*([^\n\r,]+)/i, label: 'Color' },
                    { pattern: /(?:Material|Materialien|Materials):\s*([^\n\r,]+)/i, label: 'Material' },
                    { pattern: /(?:Gewicht|Weight):\s*([^\n\r,]+)/i, label: 'Weight' },
                    { pattern: /(?:Art|Type|Category|Kategorie):\s*([^\n\r,]+)/i, label: 'Type' },
                    { pattern: /(?:Ausstattung|Features|Extras|Equipment):\s*([^\n\r]+)/i, label: 'Features' },
                    { pattern: /(?:Leistung|Power|Performance|Output):\s*([^\n\r,]+)/i, label: 'Power' },
                    { pattern: /(?:Kapazität|Capacity|Volume):\s*([^\n\r,]+)/i, label: 'Capacity' },
                    { pattern: /(?:Anzahl|Quantity|Count|Pieces):\s*([^\n\r,]+)/i, label: 'Quantity' },
                    { pattern: /(?:Packung|Package|Set):\s*([^\n\r,]+)/i, label: 'Package' }
                ];

                for (const attr of attributes) {
                    const match = text.match(attr.pattern);
                    if (match && match[1]) {
                        const value = match[1].trim();
                        if (value && !details.some(d => d.includes(attr.label))) {
                            details.push(`${attr.label}: ${value}`);
                        }
                    }
                }

                // Also try to extract from table rows if it's a table
                if (element.tagName === 'TABLE') {
                    const rows = element.querySelectorAll('tr');
                    for (const row of rows) {
                        const cells = row.querySelectorAll('td, th');
                        if (cells.length >= 2) {
                            const key = cells[0].textContent.trim();
                            const value = cells[1].textContent.trim();
                            if (key && value && key.length < 30 && value.length < 50) {
                                details.push(`${key}: ${value}`);
                            }
                        }
                    }
                }
            }
        }
    }

    // Try to find structured data in definition lists
    const dlElements = document.querySelectorAll('dl');
    for (const dl of dlElements) {
        const dts = dl.querySelectorAll('dt');
        const dds = dl.querySelectorAll('dd');

        for (let i = 0; i < Math.min(dts.length, dds.length); i++) {
            const key = dts[i].textContent.trim();
            const value = dds[i].textContent.trim();
            if (key && value && key.length < 30 && value.length < 50) {
                details.push(`${key}: ${value}`);
            }
        }
    }

    // As a last resort, try to extract from the entire page text
    if (details.length === 0) {
        const bodyText = document.body.textContent || '';

        // Look for product specification patterns in the entire page
        const pageAttributes = [
            { pattern: /(?:Marke|Brand|Hersteller|Manufacturer)[:\s]*([^\n\r,.;]+)/gi, label: 'Brand' },
            { pattern: /(?:Modell|Model|Typ|Type)[:\s]*([^\n\r,.;]+)/gi, label: 'Model' },
            { pattern: /(?:Größe|Size|Maße|Dimensions)[:\s]*([^\n\r,.;]+)/gi, label: 'Size' },
            { pattern: /(?:Zustand|Condition|Status)[:\s]*([^\n\r,.;]+)/gi, label: 'Condition' },
            { pattern: /(?:Farbe|Color|Colour)[:\s]*([^\n\r,.;]+)/gi, label: 'Color' },
            { pattern: /(?:Material|Materialien|Materials)[:\s]*([^\n\r,.;]+)/gi, label: 'Material' },
            { pattern: /(?:Gewicht|Weight)[:\s]*([^\n\r,.;]+)/gi, label: 'Weight' },
            { pattern: /(?:Art|Type|Category|Kategorie)[:\s]*([^\n\r,.;]+)/gi, label: 'Type' },
            { pattern: /(?:Ausstattung|Features|Extras|Equipment)[:\s]*([^\n\r,.;]+)/gi, label: 'Features' },
            { pattern: /(?:Leistung|Power|Performance|Output)[:\s]*([^\n\r,.;]+)/gi, label: 'Power' },
            { pattern: /(?:Kapazität|Capacity|Volume)[:\s]*([^\n\r,.;]+)/gi, label: 'Capacity' },
            { pattern: /(?:Anzahl|Quantity|Count|Pieces)[:\s]*([^\n\r,.;]+)/gi, label: 'Quantity' },
            { pattern: /(?:Packung|Package|Set)[:\s]*([^\n\r,.;]+)/gi, label: 'Package' }
        ];

        for (const attr of pageAttributes) {
            const matches = [...bodyText.matchAll(attr.pattern)];
            for (const match of matches) {
                if (match && match[1]) {
                    const value = match[1].trim();
                    if (value && value.length > 0 && value.length < 50 && !details.some(d => d.includes(attr.label))) {
                        details.push(`${attr.label}: ${value}`);
                    }
                }
            }
        }
    }

    // Remove duplicates and format
    const uniqueDetails = [...new Set(details)];

    if (uniqueDetails.length > 0) {
        return 'Product Specifications:\n' + uniqueDetails.join('\n');
    }

    return null;
}

async function injectAIEstimate(estimation) {
    // Remove any existing AI estimate
    const existingEstimate = document.getElementById('ai-estimate-container');
    if (existingEstimate) {
        existingEstimate.remove();
    }

    // Find the price element
    const priceSelectors = [
        '.ad-price',
        '[data-qa="price"]',
        '.price',
        '.aditem-price',
        '[class*="price"]'
    ];

    let priceElement = null;
    for (const selector of priceSelectors) {
        priceElement = document.querySelector(selector);
        if (priceElement) break;
    }

    if (!priceElement) {
        return;
    }

    // Get settings to access confidence threshold
    let settings = { confidenceThreshold: 70 }; // Default fallback
    try {
        settings = await window.StorageManager.getSettings();
    } catch (e) {
        console.warn('Could not load settings for confidence display:', e);
    }

    const value = estimation.value;
    const reasoning = estimation.reasoning;
    const confidence = estimation.confidence || 70;
    const threshold = settings.confidenceThreshold || 70;
    const cost = estimation.estimatedCost;
    const isError = estimation.error === true;

    // Create compact AI estimate badge
    const estimateContainer = document.createElement('div');
    estimateContainer.id = 'ai-estimate-container';
    estimateContainer.style.cssText = `
        display: inline-block;
        margin-left: 15px;
        padding: 6px 12px;
        background: linear-gradient(135deg, #f0f8ff 0%, #e1f0ff 100%);
        border: 2px solid #2196F3;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 600;
        color: #1a1a1a;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
    `;
    
    const summaryText = document.createElement('div');
    summaryText.innerHTML = `🤖 €${value !== null && value !== undefined ? value.toFixed(0) : 'N/A'} <span style="font-size: 10px;">▼</span>`;
    estimateContainer.appendChild(summaryText);
    
    // Create floating details panel
    const detailsPanel = document.createElement('div');
    detailsPanel.className = 'ai-details-panel';
    detailsPanel.style.cssText = `
        display: none;
        position: fixed;
        padding: 16px;
        background: white;
        border: 2px solid #2196F3;
        border-radius: 12px;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
        z-index: 10000;
        min-width: 400px;
        max-width: 550px;
        font-size: 13px;
        font-weight: normal;
        line-height: 1.6;
        color: #2d2d2d;
    `;
    detailsPanel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 2px solid #e9ecef;">
            <div>
                <strong style="font-size: 18px; color: #2196F3;">AI Estimate: €${value !== null && value !== undefined ? value.toFixed(2) : 'N/A'}</strong>
                <div style="font-size: 12px; color: #6c757d; margin-top: 4px;">Confidence: ${confidence}%</div>
            </div>
        </div>
        <div style="margin-bottom: 12px;">
            <strong style="color: #495057; font-size: 14px;">Reasoning:</strong>
            <div style="margin-top: 6px; color: #495057; line-height: 1.5;">${reasoning || 'No reasoning provided'}</div>
        </div>
        <div style="padding-top: 10px; border-top: 1px solid #e9ecef; font-size: 11px; color: #6c757d;">
            ${estimation.model ? `<div style="margin-bottom: 4px;"><strong>Model:</strong> ${estimation.model}</div>` : ''}
            ${!isError && cost ? `<div><strong>API Cost:</strong> ${cost.formatted} (${cost.totalTokens} tokens)</div>` : ''}
        </div>
    `;
    
    document.body.appendChild(detailsPanel);
    
    let expanded = false;
    estimateContainer.addEventListener('click', function(e) {
        e.stopPropagation();
        expanded = !expanded;
        if (expanded) {
            const rect = estimateContainer.getBoundingClientRect();
            detailsPanel.style.display = 'block';
            detailsPanel.style.top = (rect.bottom + 8) + 'px';
            detailsPanel.style.left = Math.max(10, rect.left) + 'px';
            summaryText.querySelector('span:last-child').textContent = '▲';
            estimateContainer.style.background = 'linear-gradient(135deg, #d4edff 0%, #c1e4ff 100%)';
        } else {
            detailsPanel.style.display = 'none';
            summaryText.querySelector('span:last-child').textContent = '▼';
            estimateContainer.style.background = 'linear-gradient(135deg, #f0f8ff 0%, #e1f0ff 100%)';
        }
    });
    
    // Close when clicking outside
    document.addEventListener('click', function(e) {
        if (!estimateContainer.contains(e.target) && !detailsPanel.contains(e.target) && expanded) {
            expanded = false;
            detailsPanel.style.display = 'none';
            summaryText.querySelector('span:last-child').textContent = '▼';
            estimateContainer.style.background = 'linear-gradient(135deg, #f0f8ff 0%, #e1f0ff 100%)';
        }
    });

    // Insert inline next to price
    priceElement.style.display = 'flex';
    priceElement.style.alignItems = 'center';
    priceElement.style.flexWrap = 'wrap';
    priceElement.appendChild(estimateContainer);
}