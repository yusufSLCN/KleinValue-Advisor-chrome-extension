# Troubleshooting Guide

## Analyze Button Not Appearing

### Quick Fixes

1. **Reload the Extension**
   - Go to `chrome://extensions/`
   - Find "Kleinanzeigen Monitor"
   - Click the refresh/reload icon 🔄
   - Refresh the Kleinanzeigen page

2. **Check You're on the Right Page**
   - The analyze button only appears on **individual item pages**
   - URL should look like: `https://www.kleinanzeigen.de/s-anzeige/item-name/12345`
   - NOT on search pages like: `https://www.kleinanzeigen.de/s-category/`

3. **Clear Browser Cache**
   - Press `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac) to hard reload
   - Or clear cache in browser settings

4. **Check Console for Errors**
   - Press `F12` to open Developer Tools
   - Go to "Console" tab
   - Look for red error messages
   - Share any errors you see

### Common Issues

#### Issue: Button appears briefly then disappears
**Cause**: Content script conflict  
**Fix**: 
- Rebuild the extension: `npm run build`
- Reload extension in Chrome
- Refresh the page

#### Issue: No button at all
**Cause**: Wrong page type or extension not loaded  
**Fix**:
- Verify you're on an item detail page (URL contains `/s-anzeige/`)
- Check extension is enabled in `chrome://extensions/`
- Look for console errors

#### Issue: Extension was working before
**Cause**: Code changes broke something  
**Fix**:
- Run `npm run build` to rebuild
- Reload extension
- Check manifest.json is valid JSON

### Verification Steps

1. **Check Extension is Loaded**
   ```
   chrome://extensions/
   ✓ Kleinanzeigen Monitor should be listed
   ✓ Toggle should be ON (blue)
   ✓ No errors shown
   ```

2. **Check Page Type**
   ```
   ✓ Individual item page: /s-anzeige/... (button SHOULD appear)
   ✗ Search results page: /s-... (button should NOT appear)
   ✗ Homepage: / (button should NOT appear)
   ```

3. **Check Console Logs**
   - Open DevTools (F12)
   - Go to Console tab
   - You should see:
     ```
     AI analyzer initialized successfully
     ```
   - Or error messages indicating what's wrong

### Recent Changes

The latest update added a search page feature. If the button stopped working after this update:

1. **Rebuild the extension:**
   ```bash
   cd /Users/yusufsalcan/Projects/web-apps/KleinMonitor-chrome-extension
   npm run build
   ```

2. **Reload in Chrome:**
   - Go to `chrome://extensions/`
   - Click reload icon on the extension
   - Refresh any Kleinanzeigen tabs

3. **Check manifest.json:**
   - Should have two content_scripts entries
   - One for `/s-anzeige/*` (item pages)
   - One for search pages with `exclude_matches`

### Developer Debug Mode

If you're still having issues, enable verbose logging:

1. Open `content.js`
2. Add this at the top:
   ```javascript
   console.log('Content script loaded on:', window.location.href);
   ```

3. In `injectAIAnalysisButton()` function, add:
   ```javascript
   console.log('Trying to inject button...');
   console.log('Title element found:', titleElement);
   ```

4. Rebuild and check console for these logs

### Known Limitations

- Button only appears on individual item pages
- Requires page to be fully loaded (wait a second if needed)
- Some Kleinanzeigen page layouts might not be supported
- Ad blockers might interfere (try disabling temporarily)

### Still Not Working?

If none of the above helps:

1. **Collect Debug Info:**
   - Browser version
   - Extension version
   - Console error messages
   - URL where button should appear
   - Screenshot of the page

2. **Try Clean Install:**
   ```bash
   # Remove extension from Chrome
   # Delete node_modules and dist
   rm -rf node_modules dist
   
   # Reinstall
   npm install
   npm run build
   
   # Reload extension in Chrome
   ```

3. **Check File Structure:**
   ```
   dist/
   ├── content.js ✓
   ├── content-search.js ✓
   ├── utils.js ✓
   └── ... other files
   ```

---

**Quick Test:**
Visit: `https://www.kleinanzeigen.de/s-anzeige/` + any item ID
The button should appear next to the item title.
