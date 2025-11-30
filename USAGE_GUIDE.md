# Quick Start Guide - Search Page AI Price Indicators

## 🚀 How to Use the New Feature

### Step 1: Analyze Items
1. Visit any Kleinanzeigen item page
2. Click the **"🤖 Analyze with AI"** button
3. Wait for the AI analysis to complete
4. The AI estimate will be saved automatically

### Step 2: Browse Search Results
1. Navigate to any Kleinanzeigen search page
   - Example: `https://www.kleinanzeigen.de/s-smartphones/c173`
   - Or use the search function on the site
2. Look for small **price badges** next to the listing prices

### Step 3: Understand the Badges

#### 🤖 Regular AI Price Badge
- **Gray badge** with robot emoji
- Shows the AI estimated price
- Hover to see details

#### 💎 Bargain Badge
- **Green badge** with diamond emoji
- Indicates AI price is 20%+ higher than listing
- These are potential good deals!

### Step 4: Get More Info
1. **Hover** over any badge
2. A tooltip will show:
   - Full AI estimate
   - Listed price
   - Confidence score
   - Whether it's a bargain

## 📸 Visual Examples

```
Before (Regular Search Result):
┌─────────────────────────────┐
│ iPhone 12 Pro               │
│ 📍 Berlin                   │
│ €450                        │
└─────────────────────────────┘

After (With AI Badge):
┌─────────────────────────────┐
│ iPhone 12 Pro               │
│ 📍 Berlin                   │
│ €450  [🤖 €520]             │ ← AI price badge
└─────────────────────────────┘

Bargain Item:
┌─────────────────────────────┐
│ MacBook Pro M1              │
│ 📍 Munich                   │
│ €800  [💎 €1100]            │ ← Potential bargain!
└─────────────────────────────┘
```

## 💡 Tips & Tricks

### Maximize Value
- Analyze items while browsing normally
- Return to search pages later to see all AI prices at once
- Focus on 💎 diamond badges for best deals

### Keyboard Shortcuts
- Use browser back button to return to search quickly
- Open items in new tabs (Ctrl/Cmd + Click) to keep search page open

### Best Practices
1. **Analyze strategically**: Focus on items you're seriously interested in
2. **Check confidence**: Higher confidence = more reliable estimate
3. **Compare bargains**: Not all 💎 badges are equal - check the tooltip
4. **Re-analyze old items**: Prices and market conditions change

## 🔧 Troubleshooting

### Badges Not Appearing?
- ✅ Check you've analyzed some items first
- ✅ Make sure you're on a search/listing page (not an item page)
- ✅ Try refreshing the page
- ✅ Check browser console for errors

### Wrong Prices Showing?
- Items may have been updated since analysis
- Click through to re-analyze with current data

### Tooltip Not Showing?
- Make sure you're hovering directly over the badge
- Check your browser zoom level (100% recommended)

## 📊 Understanding the Data

### Confidence Score
- **90-100%**: Very reliable estimate
- **70-89%**: Good estimate
- **50-69%**: Moderate confidence
- **Below 50%**: Low confidence (be cautious)

### Bargain Threshold
- Calculated as: AI Price > Listed Price × 1.2
- Means AI thinks item is worth at least 20% more
- Does NOT guarantee actual market value
- Always do your own research!

## 🎯 Advanced Usage

### Hunting for Deals
1. Search broad categories (e.g., "Electronics")
2. Analyze promising items (10-20)
3. Return to search page
4. Scan for 💎 badges
5. Focus on high-confidence bargains

### Building a Database
- Analyze items over time
- Build a personal price reference database
- Compare similar items across searches

### Export Your Data
- Use the Dashboard to view all analyzed items
- Sort by bargain potential (coming soon)
- Export to CSV (coming soon)

---

**Need Help?** Open an issue on GitHub or check the full documentation in README.md
