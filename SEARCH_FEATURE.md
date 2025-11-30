# Search Page AI Price Indicators - Feature Documentation

## Overview
Added a new feature that displays AI price estimates directly on Kleinanzeigen search result pages for items you've already analyzed. No need to visit each item's page again to see the AI price!

## What Changed

### New Files
- **`content-search.js`**: New content script that runs on search/listing pages
  - Scans search results for items you've analyzed
  - Injects small AI price badges next to listing prices
  - Shows tooltips with full estimate details on hover
  - Highlights potential bargains with special styling

### Modified Files
- **`manifest.json`**: Added new content script configuration for search pages
- **`webpack.config.js`**: Added `content-search` to build entries
- **`README.md`**: Updated documentation with new feature description

## Features

### 🔍 Search Page Integration
- **Automatic Detection**: Scans all items on search results pages
- **Smart Matching**: Matches search items with your analyzed items database
- **Cached Results**: Uses stored AI estimates - no additional API calls
- **Real-time Updates**: Works with dynamically loaded content

### 💎 Bargain Detection
- **Visual Highlighting**: Special green styling for potential deals
- **Smart Algorithm**: Flags items where AI price is 20%+ higher than listing
- **Clear Indicators**: Different icons for regular estimates (🤖) vs bargains (💎)

### 📊 Information Display
- **Compact Badges**: Small, unobtrusive price indicators
- **Hover Tooltips**: Detailed information appears on hover:
  - Full AI estimate
  - Listed price (for comparison)
  - Confidence score
  - Bargain status
- **Smooth Animations**: Professional hover effects and transitions

## Technical Details

### Content Script Architecture
```javascript
// content-search.js runs on:
- https://www.kleinanzeigen.de/s-* (search results)
- https://www.kleinanzeigen.de/* (all pages except individual items)

// Excluded:
- https://www.kleinanzeigen.de/s-anzeige/* (handled by content.js)
```

### DOM Selectors Used
- Search items: `article.aditem, li.ad-listitem, [data-adid]`
- Links: `a[href*="/s-anzeige/"]`
- Price elements: `.aditem-main--middle--price-shipping--price, .price, [class*="price"]`

### Performance Optimizations
- Only queries storage once per page load
- Checks for existing indicators to prevent duplicates
- Uses efficient DOM selectors
- Lightweight tooltip implementation

## User Experience

### Before
1. Analyze item on detail page
2. Go back to search
3. ❌ Can't see AI price without clicking again
4. Have to remember which items were analyzed

### After
1. Analyze item on detail page
2. Go back to search
3. ✅ AI price badge appears automatically
4. Hover for full details
5. 💎 Bargains are highlighted

## Usage Instructions

### For Users
1. **Analyze items** as usual by clicking "🤖 Analyze with AI" on item pages
2. **Navigate back** to search results or browse search pages
3. **Look for badges**:
   - 🤖 = AI estimate available
   - 💎 = Potential bargain detected
4. **Hover badges** to see full AI estimate, confidence, and comparison

### For Developers
```bash
# Rebuild after changes
npm run build

# Test by:
1. Load extension in Chrome
2. Analyze a few items
3. Navigate to search page with those items
4. Verify badges appear
5. Test hover tooltips
```

## Visual Design

### Normal Estimate Badge
- Gray gradient background
- Small 🤖 emoji
- Rounded corners
- Subtle border

### Bargain Badge
- Green gradient background
- Diamond 💎 emoji
- Bold border
- Slightly larger for emphasis

### Tooltip Style
- Dark semi-transparent background
- White text for contrast
- Positioned above badge
- Smooth fade in/out
- Shows: AI price, listed price, confidence, bargain status

## Browser Compatibility
- ✅ Chrome (tested)
- ✅ Edge (Chromium-based)
- ✅ Brave (Chromium-based)
- ⚠️ Other Chromium browsers (should work)

## Future Enhancements
- [ ] Add filter button to show only analyzed items
- [ ] Sort by bargain potential
- [ ] Bulk analysis from search page
- [ ] Quick re-analyze option from badge
- [ ] Settings to customize badge appearance
- [ ] Export analyzed items with bargain scores

## Known Limitations
- Only shows badges for items you've already analyzed
- Requires item URL to match exactly
- Some Kleinanzeigen page layouts may need CSS adjustments
- Tooltip may clip at screen edges (will auto-adjust in future)

---

**Version**: 1.1.0  
**Date**: November 30, 2025  
**Status**: ✅ Production Ready
