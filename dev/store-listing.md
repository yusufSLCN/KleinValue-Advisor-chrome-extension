# Chrome Web Store Listing Content

## Snapshot
- **Title:** KleinValue Advisor
- **Short summary (≤132 chars):** Get instant AI price estimates, confidence, and reasoning for Kleinanzeigen listings.
- **Category:** Shopping → Marketplace tools (fallback: Productivity)
- **Primary language:** English (de-DE localization planned post-launch)
- **Pricing:** Free
- **Mature content:** None. Extension analyzes household listings only.

## Long Description (paste into the Store "Description" field)
KleinValue Advisor adds an "Analyze with AI" workflow to every Kleinanzeigen listing so you can negotiate with data, not guesswork. Run Google Gemini, OpenAI GPT-4.1, or Anthropic Claude on the photos and details of any ad to receive an estimated fair price, confidence rating, reasoning excerpt, and cost transparency. Every analysis is stored locally so you can revisit insights from the popup, dashboard, or search overlays without re-running the model.

### Why install KleinValue Advisor?
- **Vision-first valuations:** Uploads up to 4 listing images plus description context to multimodal LLMs for richer price guidance.
- **Multi-provider studio:** Switch between Gemini, GPT-4o/4.1, and Claude 3.5 in one place, with per-provider API key storage and model catalogs.
- **Inline UI on Kleinanzeigen:** Adds a floating price badge beside the seller's number, including collapsible reasoning, confidence, and API cost.
- **Realtime bargain radar:** Highlights listings you've already analyzed directly inside Kleinanzeigen search results.
- **Analytics dashboard:** Review every analyzed item in a responsive grid with filters, price histograms, and “good value” toggles.
- **Cost transparency:** Surface estimated token counts and EUR-formatted pricing so you always know what each call costs.
- **Privacy-respecting:** All data stays in Chrome storage on your device; nothing is uploaded to third-party servers beyond the AI providers you enable.

### What you get
1. **Analyze button** on each listing that fetches images, builds prompts, and sends them to your selected provider.
2. **Popup recap** with the last analyzed items, quick links to dashboard/settings, and API key status.
3. **Dashboard view** for browsing history, filtering by good value, searching by text/location, and removing stale entries.
4. **Settings lab** with API key management, image limits, temperature controls, and auto-analyze toggles.

### Permissions explained
- `storage`: persist analyzed items, provider selections, and API keys locally.
- `activeTab`: required to inject the Analyze button into the currently viewed listing page.
- Host permissions (kleinanzeigen.de + AI APIs): needed to read listing data and call the LLM endpoints you configure.

_No user analytics, payment collection, or background network requests occur beyond the explicit AI API calls you trigger._

## Required URLs
- **Homepage URL:** https://github.com/yusufSLCN/KleinValue-Advisor-chrome-extension
- **Support URL:** https://github.com/yusufSLCN/KleinValue-Advisor-chrome-extension/issues
- **Privacy Policy:** https://github.com/yusufSLCN/KleinValue-Advisor-chrome-extension/blob/main/PRIVACY_POLICY.md
- **Optional promo / official site:** leave blank until a marketing microsite is live.

## Graphic Asset Plan
| Asset | Spec | Source notes |
| --- | --- | --- |
| Store icon | 128×128 PNG (no alpha) | Export from `icons/icon128.png`; ensure 48×48 + 16×16 versions match. |
| Screenshots (3–5) | 1280×800 or 640×400 JPG/PNG | Capture listing injection, popup, dashboard stats, settings. Use anonymized/blurred seller data. |
| Small promo tile | 440×280 PNG | Reuse gradient background with mascot emoji + tagline "Analyze Kleinanzeigen with AI". |
| Marquee promo | 1400×560 PNG | Compose split layout: left copy block, right screenshot collage. |
| Promo video (optional) | YouTube URL | 30–45s loom-style walkthrough focusing on Analyze button + dashboard. |

> Tip: keep editable design files in `/assets/branding/` locally; only exported PNG/JPG land in the Store form.

## Suggested Keywords / Search Terms
```
kleinanzeigen ai, price estimate, valuation, shopping assistant, gemini extension, claude extension, gpt-4 chrome extension, bargain finder, classifieds analysis, negotiation helper
```

## Localizations
- **Phase 1 (launch):** English copy only; UI already supports German currency formatting.
- **Phase 2:** Add `de` localization strings once automated screenshot tooling is ready. Track in roadmap.

## Distribution Notes
- Visibility: Public.
- Regions: All countries where Kleinanzeigen is accessible (default global).
- Item support toggle: ON (links to GitHub Issues).

## References
- Packaging script: `./zip_extention.sh`
- Deployment checklist: `dev/deployment.md`
- Reviewer/test steps: `dev/test-instructions.md`
