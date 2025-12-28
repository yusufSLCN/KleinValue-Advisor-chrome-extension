# Privacy Policy

_Last updated: December 28, 2025_

KleinValue Advisor ("the Extension") is a personal Chrome extension created by Yusuf Salcan. This document explains what data the Extension processes, how that data is used, and your privacy choices when using the Extension.

## Data We Collect and Process

The Extension runs entirely in your browser context and does not maintain a server-side database. It processes the following data to deliver AI-powered valuations:

1. **Listing Content**: Title, price, description, images, location, and metadata from the Kleinanzeigen listing currently viewed or selected in search results.
2. **User Inputs**: API keys for Google Gemini, OpenAI, Anthropic, and any optional custom provider endpoints. These keys are stored only in Chrome `storage.local` within your browser profile.
3. **Usage Preferences**: Provider selections, model choices, automation toggles, and UI settings saved locally to improve your workflow.
4. **AI Responses**: Price estimates, reasoning text, confidence scores, and token/cost information returned by the AI providers.

## How Data Is Used

- Listing content and user inputs are packaged into prompts sent to the selected AI provider’s API endpoint (Gemini, OpenAI, Anthropic, or a custom endpoint you configure).
- The Extension displays AI responses inside Kleinanzeigen, the popup, and dashboards to help you evaluate listings.
- Provider API keys are never transmitted anywhere except directly to the provider endpoints you enable.
- No analytics, telemetry, or behavioral tracking is implemented. All computations happen in your browser except for outbound API requests you trigger.

## Data Storage and Retention

- Data persists only in Chrome `storage.local` on the device/browser profile where you run the Extension.
- Removing the Extension or clearing Chrome extension storage will delete all locally stored analysis history and API keys.
- No centralized or cloud storage is used by default.

## Third-Party Services

When you enable provider integrations, data is transmitted to these APIs under their respective privacy policies:

- Google Gemini (Google Generative AI APIs)
- OpenAI API
- Anthropic API
- Any custom provider endpoint you configure

Review each provider’s documentation and terms to ensure you are comfortable with their data handling practices before supplying keys.

## Your Choices

- You can delete saved analyses and keys at any time via the Extension’s settings or by clearing Chrome extension storage.
- To stop all processing, remove the Extension from Chrome.

## Security

- API keys and analysis data are stored using Chrome’s extension storage APIs, which are isolated per profile.
- The Extension uses HTTPS endpoints for all provider communications.
- You are responsible for safeguarding your API keys and browser profile.

## Changes to This Policy

Updates may occur as the Extension evolves. The latest version of this policy will always be available in the repository and should accompany any Chrome Web Store submission.

## Contact

For privacy questions or to report issues, please reach out via GitHub Issues at [https://github.com/yusufSLCN/KleinValue-Advisor-chrome-extension/issues](https://github.com/yusufSLCN/KleinValue-Advisor-chrome-extension/issues).
