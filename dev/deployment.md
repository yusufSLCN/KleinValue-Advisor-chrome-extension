# Chrome Web Store Deployment Checklist

## Pre-Deployment Preparation

- [ ] **Update manifest.json for production**
  - [ ] Change version to semantic versioning (e.g., "1.0.0")
  - [ ] Remove overly broad permissions (`"*://*/*"`)
  - [ ] Remove unnecessary permissions (`"activeTab"`)
  - [ ] Add required icon specifications
  - [ ] Limit web_accessible_resources to specific domains
  - [ ] Add privacy_policy_url

- [ ] **Create extension icons**
  - [ ] Create icons/icon16.png (16x16)
  - [ ] Create icons/icon32.png (32x32)
  - [ ] Create icons/icon48.png (48x48)
  - [ ] Create icons/icon128.png (128x128)
  - [ ] Use PNG format with transparent background

- [ ] **Privacy Policy**
  - [ ] Create comprehensive privacy policy covering:
    - [ ] Data collection (item details, images)
    - [ ] API usage (Google Gemini)
    - [ ] Local storage usage
    - [ ] Data retention and deletion
    - [ ] Contact information
  - [ ] Host privacy policy on website
  - [ ] Add URL to manifest.json

- [ ] **Build production version**
  - [ ] Run `npm run build` for production
  - [ ] Verify all files are in dist/ folder
  - [ ] Test built extension functionality

## Store Listing Assets

- [ ] **Screenshots (3-5 required)**
  - [ ] Screenshot of extension popup
  - [ ] Screenshot of dashboard with items
  - [ ] Screenshot of analysis in action
  - [ ] Screenshot of settings page
  - [ ] Resolution: 1280x800 or 640x400

- [ ] **Store Listing Content**
  - [ ] Detailed description (explain AI analysis, features)
  - [ ] Short description (under 132 characters)
  - [ ] Category: "Productivity" or "Shopping"
  - [ ] Language: English (primary)

## Testing & Validation

- [ ] **Extension Testing**
  - [ ] Test on different Chrome versions
  - [ ] Test on different screen sizes
  - [ ] Verify all features work
  - [ ] Check for console errors
  - [ ] Test API key configuration
  - [ ] Test item analysis functionality

- [ ] **Manifest Validation**
  - [ ] Validate manifest.json syntax
  - [ ] Check all required fields present
  - [ ] Verify permissions are minimal and necessary
  - [ ] Test manifest in Chrome developer mode

## Chrome Web Store Submission

- [ ] **Developer Account**
  - [ ] Create Chrome Web Store developer account
  - [ ] Pay $5 one-time registration fee

- [ ] **Package Extension**
  - [ ] Create ZIP file of extension folder
  - [ ] Exclude development files (.git, node_modules, src, etc.)
  - [ ] Include only: manifest.json, dist/, icons/, HTML files

- [ ] **Upload & Configure**
  - [ ] Upload ZIP file to developer dashboard
  - [ ] Fill out store listing details
  - [ ] Upload screenshots
  - [ ] Set pricing (free)
  - [ ] Configure regions (if needed)

- [ ] **Review & Launch**
  - [ ] Submit for review
  - [ ] Wait for review (1-2 weeks)
  - [ ] Address any review feedback
  - [ ] Publish extension

## Post-Launch Activities

- [ ] **Monitor & Maintain**
  - [ ] Monitor user reviews and ratings
  - [ ] Respond to user feedback
  - [ ] Track extension usage analytics
  - [ ] Plan regular updates

- [ ] **Future Development**
  - [ ] Add multi-AI provider support (OpenAI, Claude, etc.)
  - [ ] Implement user feedback features
  - [ ] Add advanced filtering options
  - [ ] Consider premium features

## Common Issues & Solutions

- [ ] **Permission Rejections**: Ensure all permissions are justified and minimal
- [ ] **Privacy Policy Missing**: Must have hosted privacy policy
- [ ] **Poor Screenshots**: Use high-quality, relevant screenshots
- [ ] **Manifest Errors**: Validate JSON and follow MV3 guidelines
- [ ] **External Dependencies**: Ensure all APIs are properly declared

## Resources

- [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard)
- [Manifest V3 Documentation](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Extension Quality Guidelines](https://developer.chrome.com/docs/webstore/program-policies/)
- [Privacy Policy Template](https://www.freeprivacypolicy.com/free-privacy-policy-generator/)