# KleinValue Advisor - Advanced AI Chrome Extension

A powerful Chrome extension that analyzes Kleinanzeigen listings using Google Gemini, OpenAI GPT-4o/4.1, or Anthropic Claude models—complete with dynamic model catalogs, visual analysis, and transparent cost tracking.

## ✨ Key Features

### 🔌 Multi-Provider Flexibility
- **One UI, Three Providers**: Seamlessly switch between Google Gemini, OpenAI GPT-4o/4.1, or Anthropic Claude without leaving the extension.
- **Live Model Catalogs**: Fetch the latest deployable models directly from each provider's API and pin your favorites per provider.
- **Per-Provider API Keys**: Securely store different API keys and model selections; the estimator automatically loads the right backend at runtime.

### 🤖 Advanced AI Analysis
- **Latest Foundation Models**: Choose between Gemini 2.5 (Flash/Pro/Lite), GPT-4.1 / GPT-4o variants, or Claude 3.5 families
- **Visual Analysis**: AI analyzes product images for condition, quality, and features
- **Confidence Scoring**: Real confidence scores (0-100) surfaced on every estimate
- **Smart Image Processing**: Automatically finds and processes all product images
- **Search Page Integration**: AI price indicators appear on search results for analyzed items
- **Bargain Detection**: Automatic highlighting of potential deals on search pages

### 📊 Modern Dashboard
- **Elegant Design**: Clean, intuitive interface following modern UI/UX principles
- **Expandable Statistics**: Collapsible stats section with key metrics
- **Powerful Search**: Real-time search across titles, locations, and AI reasoning
- **Individual Item Management**: Remove specific items with dedicated delete buttons
- **Responsive Layout**: Optimized for all screen sizes

### ⚙️ Comprehensive Settings
- **Provider Studio**: Gradient-rich settings surface with provider cards, contextual docs links, and per-provider API key management
- **Live Model Picker**: Refresh model lists straight from each provider's API and persist selections separately
- **Analysis Controls**: Configure temperature, image usage, and automation in a single responsive grid
- **One-Click Testing**: Validate keys and fetch models simultaneously with real-time status banners

### 💰 Cost Transparency
- **Real-time Cost Tracking**: Shows actual API costs per analysis
- **Token Usage**: Displays input/output tokens consumed
- **Pricing Updates**: Latest 2025 Gemini API pricing
- **Cost Optimization**: Choose models based on speed vs. accuracy needs

### 🔧 Technical Excellence
- **Serverless Architecture**: All processing happens client-side
- **Local Storage**: Data persists securely in Chrome storage
- **Modular Design**: Clean, maintainable codebase with webpack bundling and shared `lib/` modules for estimator, storage, and factory logic
- **Provider Registry**: Central metadata + estimator registry powers multi-provider switching without code duplication
- **Error Handling**: Robust error handling and fallback mechanisms

## 🚀 Quick Start

### Installation
1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Build the Extension**
   ```bash
   npm run build
   ```

3. **Load in Chrome**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `chrome_extension` folder

### Configuration
1. **API Key Setup**
   - Click the extension icon in Chrome toolbar
   - Open the settings (⚙️) panel
   - Select your preferred provider card (Gemini, OpenAI, or Anthropic)
   - Paste the corresponding API key and run **Test Key** to fetch the live model list

2. **Customize Settings**
   - Pick a model per provider (e.g., Gemini 2.5 Flash, GPT-4.1 Mini, or Claude 3.5 Sonnet)
   - Tune auto-analysis behavior, temperature, and image usage in the Analysis Controls block
   - Refresh models anytime to stay current with the provider's catalog

## 📖 How to Use

### Basic Analysis
1. **Visit any Kleinanzeigen listing**
2. **Click "🤖 Analyze with AI"** button (appears automatically on item pages)
3. **View AI estimate** with confidence score and reasoning
4. **Click "Show Details"** for full analysis including API cost

### Search Page Price Indicators
- **💎 Smart Icons**: AI price badges appear automatically on search results for items you've already analyzed
- **Bargain Detection**: Special highlighting for potential deals (AI price 20%+ higher than listing)
- **Quick Tooltips**: Hover over any price icon to see full AI estimate and confidence score
- **No Extra Analysis**: Shows cached results instantly - no additional API calls needed

### Dashboard Features
- **📊 Expandable Statistics**: Click "Show Statistics" for overview metrics with smooth animations
- **🔍 Real-time Search**: Instant search across titles, locations, and AI reasoning
- **🗑️ Individual Item Management**: Delete specific items with dedicated remove buttons
- **💰 Price Comparison**: See both listing price and AI estimate side-by-side
- **ℹ️ AI Reasoning Tooltips**: Hover over info icon for detailed AI reasoning
- **📱 Responsive Design**: Optimized for desktop and mobile devices
- **🎨 Modern UI**: Clean, intuitive interface with smooth hover effects

### Advanced Features
- **Visual Analysis**: AI examines product images for accurate assessments
- **Confidence Display**: Always shows AI certainty scores alongside values
- **Cost Tracking**: Monitor API usage and costs in real-time
- **Model Selection**: Choose different AI models for speed vs. accuracy
- **Smart Image Processing**: Automatic image discovery and filtering
- **Price Comparison**: Instant comparison between listing and AI estimate
- **Interactive Reasoning**: Hover tooltips for detailed AI explanations

## 🛠️ Development

### Commands
- `npm run dev` - Development mode with file watching
- `npm run build` - Production build with minification & asset copying

### Architecture
- **🤖 AI-First**: Live provider registry spanning Gemini 2.5, GPT-4.1/4o, and Claude 3.5 families
- **🎨 Modern UI**: Responsive design with smooth animations
- **🔒 Privacy-Focused**: All data stored locally, no external servers
- **⚡ Performance**: Optimized bundling and efficient API usage
- **🧩 Modular**: Clean separation of concerns with ES modules
- **📦 Best Practices**: External CSS, webpack asset copying, organized file structure

## 📁 Project Structure

```
chrome_extension/
├── manifest.json          # Extension configuration & permissions
├── lib/                  # Shared estimators, storage, and provider registry
│   ├── gemini-estimator.js
│   ├── openai-estimator.js
│   ├── anthropic-estimator.js
│   ├── estimation-core.js
│   ├── providers/
│   │   ├── metadata.js
│   │   └── registry.js
│   ├── storage-manager.js
│   └── index.js
├── content.js            # Injects analysis UI on Kleinanzeigen pages
├── utils.js              # Re-exports shared modules for backward compatibility
├── popup.html/js         # Compact extension popup
├── dashboard.html/js     # Modern dashboard with search, stats, & management
├── dashboard.css         # External styles for dashboard (best practices)
├── settings.html/js      # Comprehensive configuration panel
└── dist/                 # Built assets (auto-generated)
```

## 🔑 API Configuration

### Getting API Keys
- **Google Gemini**: https://aistudio.google.com/app/apikey
- **OpenAI Platform**: https://platform.openai.com/api-keys
- **Anthropic Claude**: https://console.anthropic.com/account/keys

### Rate Limits (Reference)
- **Gemini Free Tier**: 60 requests/minute • 1,500 requests/day • Free for personal use
- **OpenAI & Anthropic**: Follow the quota shown in your provider console (varies per billing plan)

### Model Recommendations
- **Gemini 2.5 Flash**: Best balance of speed and accuracy (defaults in settings)
- **GPT-4.1 Mini**: Fast GPT family member with excellent reasoning, great for text-heavy listings
- **Claude 3.5 Sonnet**: Strong structured reasoning with concise JSON responses
- **Gemini 2.5 Pro**: Maximum intelligence for complex items requiring multimodal context

## 🎯 Advanced Features

### AI Confidence System
- Real confidence scores surfaced directly from each provider
- Always displayed with every estimate for transparency
- Helps you decide when to trust, retry, or compare listings

### Cost Optimization
- Automatic cost calculation per request
- Token usage tracking
- Model selection based on cost vs. performance

### Smart Image Processing
- Automatic image discovery and filtering
- Size-based filtering (excludes icons)
- Base64 encoding for API compatibility
- Configurable image limits

---

**Made with ❤️ for Kleinanzeigen users who want data-driven buying decisions**