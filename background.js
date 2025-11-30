/**
 * Background script for Kleinanzeigen AI Analyzer
 * Handles messages from content script for analysis and server start
 */

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startServer') {
    // Extensions can't directly start servers, so notify user
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon.png',  // Add an icon.png to the directory if available
      title: 'Server Start Required',
      message: 'Please start the backend server manually:\nfrom project root, run `python run_web.py`'
    });
    sendResponse({success: false, message: 'Manual start required'});
  } else if (request.action === 'analyzeItem') {
    console.log('Background: Starting analysis for item:', request.itemData.title);

    // Perform health check
    fetch('http://localhost:8001/api/health')
      .then(r => {
        console.log('Background: Health check response status:', r.status);
        if (!r.ok) {
          throw new Error(`Health check failed: ${r.status}`);
        }
        return r.json();
      })
      .then(health => {
        console.log('Background: Health check result:', health);
        if (health.status !== 'healthy') {
          sendResponse({success: false, error: 'Server not healthy'});
          return;
        }

        // Perform analysis
        console.log('Background: Starting analysis fetch...');
        fetch('http://localhost:8001/api/analyze_single_item', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(request.itemData)
        })
        .then(r => {
          console.log('Background: Analysis response status:', r.status);
          return r.text().then(text => {
            console.log('Background: Raw response text:', text);
            if (!r.ok) {
              throw new Error(`Analysis failed: ${r.status} - ${text}`);
            }
            try {
              const result = JSON.parse(text);
              console.log('Background: Analysis result:', result);
              sendResponse(result);
            } catch (e) {
              console.log('Background: Failed to parse JSON:', e);
              sendResponse({success: false, error: `Invalid JSON response: ${text}`});
            }
          });
        })
        .catch(err => {
          console.log('Background: Analysis error:', err);
          sendResponse({success: false, error: err.message});
        });
      })
      .catch(err => {
        console.log('Background: Health check error:', err);
        sendResponse({success: false, error: err.message});
      });
    return true; // Keep message channel open for async response
  }
  return true;
});