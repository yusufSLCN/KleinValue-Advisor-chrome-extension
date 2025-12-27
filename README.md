# KleinValue Advisor - Advanced AI Chrome Extension

A powerful Chrome extension that analyzes Kleinanzeigen listings using Google's latest Gemini AI models to provide accurate market value estimates with visual analysis.

## ✨ Key Features

### 🤖 Advanced AI Analysis
- **Latest Gemini 2.5 Models**: Access to cutting-edge AI with Gemini 2.5 Flash, Pro, and Flash-Lite
- **Visual Analysis**: AI analyzes product images for condition, quality, and features
- **Confidence Scoring**: Real confidence scores (0-100) with customizable thresholds
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
- **Model Selection**: Choose from multiple Gemini models for different use cases
- **Image Controls**: Configure maximum images and enable/disable visual analysis
- **Confidence Threshold**: Set minimum confidence level for displaying estimates
- **Auto-Analysis**: Toggle automatic analysis when visiting listings

### 💰 Cost Transparency
- **Real-time Cost Tracking**: Shows actual API costs per analysis
- **Token Usage**: Displays input/output tokens consumed
- **Pricing Updates**: Latest 2025 Gemini API pricing
- **Cost Optimization**: Choose models based on speed vs. accuracy needs

### 🔧 Technical Excellence
- **Serverless Architecture**: All processing happens client-side
- **Local Storage**: Data persists securely in Chrome storage
- **Modular Design**: Clean, maintainable codebase with webpack bundling
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
   - Click the settings (⚙️) button
   - Enter your Google Gemini API key
   - Test the connection

2. **Customize Settings**
   - Choose your preferred AI model (Gemini 2.5 Flash recommended)
   - Set confidence threshold (70% recommended)
   - Configure image analysis settings
   - Enable auto-analysis for seamless experience

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
- **Confidence Filtering**: Only shows estimates above your threshold
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
- **🤖 AI-First**: Latest Gemini 2.5 models with multimodal capabilities
- **🎨 Modern UI**: Responsive design with smooth animations
- **🔒 Privacy-Focused**: All data stored locally, no external servers
- **⚡ Performance**: Optimized bundling and efficient API usage
- **🧩 Modular**: Clean separation of concerns with ES modules
- **📦 Best Practices**: External CSS, webpack asset copying, organized file structure

## 📁 Project Structure

```
chrome_extension/
├── manifest.json          # Extension configuration & permissions
├── content.js            # Injects analysis UI on Kleinanzeigen pages
├── utils.js              # Gemini API integration & cost calculation
├── popup.html/js         # Compact extension popup
├── dashboard.html/js     # Modern dashboard with search, stats, & management
├── dashboard.css         # External styles for dashboard (best practices)
├── settings.html/js      # Comprehensive configuration panel
└── dist/                 # Built assets (auto-generated)
```

## 🔑 API Configuration

### Getting Your Gemini API Key
Visit: https://aistudio.google.com/app/apikey

### Rate Limits (Free Tier)
- **60 requests/minute**
- **1,500 requests/day**
- **Free for personal use**

### Model Recommendations
- **Gemini 2.5 Flash**: Best balance of speed and accuracy (recommended)
- **Gemini 2.5 Pro**: Maximum intelligence for complex items
- **Gemini 2.5 Flash-Lite**: Fastest processing for simple items

## 🎯 Advanced Features

### AI Confidence System
- Real confidence scores from Gemini AI
- Configurable thresholds (0-100%)
- Only displays estimates above your threshold

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