// Simple test script to verify extension loads
console.log('===================================');
console.log('TEST SCRIPT LOADED SUCCESSFULLY!!!');
console.log('URL:', window.location.href);
console.log('===================================');

// Try to inject a visible alert on the page
setTimeout(() => {
    const testDiv = document.createElement('div');
    testDiv.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: red;
        color: white;
        padding: 20px;
        z-index: 999999;
        font-size: 20px;
        font-weight: bold;
    `;
    testDiv.textContent = 'EXTENSION LOADED!';
    document.body.appendChild(testDiv);
}, 1000);
