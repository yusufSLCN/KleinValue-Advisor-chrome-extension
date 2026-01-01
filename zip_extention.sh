zip -r KleinValueAdvisor.zip \
    manifest.json popup.html popup.js popup.css \
    dashboard.html dashboard.js dashboard.css \
    settings.html settings.js settings.css \
    background.js content.js content-search.js content.css \
    utils.js lib/ assets/ icons/ dist/ \
    -x "node_modules/*" "dev/*" "*.log" ".git/*" "*.DS_Store"