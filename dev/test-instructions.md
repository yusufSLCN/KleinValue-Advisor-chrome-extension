# Chrome Web Store Test Instructions

Use these notes verbatim inside the "Test Instructions" field so Chrome reviewers can verify the extension quickly.

---

## 1. Install the package
1. Download the submitted ZIP produced by `zip_extention.sh`.
2. In Chrome, open `chrome://extensions`, enable **Developer mode**, and click **Load unpacked** → select the unzipped folder.
3. Ensure "Errors" stays empty after installation.

## 2. Configure an AI provider
1. Open the extension popup → **Settings** (or browse directly to `chrome-extension://<ID>/settings.html`).
2. In the "Google Gemini" card, paste a valid Gemini API key (reviewers can generate a free key at https://aistudio.google.com/app/apikey).
3. Click **Save**; the status badge should switch to ✅ Configured.
4. Optional: choose a different provider/model if you already maintain OpenAI or Anthropic keys.

> The extension never ships with embedded keys. Each reviewer must use their own test key or the temporary credentials provided in the submission notes (if supplied separately).

## 3. Run an end-to-end analysis
1. Visit any Kleinanzeigen listing, e.g. https://www.kleinanzeigen.de/s-anzeige/fahrrad/1234567890 (any public listing works).
2. Click the new **🤖 Analyze with AI** button below the title.
3. A loading state appears, followed by a green "Analyzed" sticker.
4. Expand the inline badge to view the AI estimate, reasoning, confidence, and token cost.
5. Observe that the popup and dashboard now show the analyzed item with prices formatted in €.

## 4. (Optional) Seed demo data without running the API
If you cannot call an AI provider, you can still verify the UI using bundled sample data:
1. Go to `chrome://extensions`, click **Service Worker** ▸ **Inspect views** for KleinValue Advisor.
2. In the console, paste:
   ```js
   fetch(chrome.runtime.getURL('dev/test-data/sample-analyzed-items.json'))
     .then((r) => r.json())
     .then((items) => chrome.storage.local.set({ analyzedItems: items }));
   ```
3. Reload the popup or dashboard to see three representative analyses covering good-value, neutral, and overpriced items.

## 5. Dashboard and popup checks
- Popup lists the most recent analyses with listed vs AI price comparisons.
- Dashboard (`chrome-extension://<ID>/dashboard.html`) displays filters, histograms, and allows deleting entries.
- Search results on Kleinanzeigen show "Analyzed" chips for cached items.

## 6. Permissions & privacy validation
- `storage` is used solely for local history and API keys.
- `activeTab` is needed to inject the Analyze button into the current listing.
- No background requests occur beyond the configured AI endpoints.

## 7. Reset / cleanup
- In popup ▸ Settings, clear the API key (set empty string) and click **Clear analyzed history** to remove stored data.
- Remove the extension from `chrome://extensions` when finished.

Support contact: https://github.com/yusufSLCN/KleinValue-Advisor-chrome-extension/issues
