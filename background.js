// Background script for the Chrome extension

chrome.runtime.onInstalled.addListener(() => {
    console.log("P2P File Sharing Extension installed.");
    // Perform further initialization if necessary
});

// Listener for browser action (icon click)
chrome.action.onClicked.addListener((tab) => {
    // Send a message to the content script
    chrome.tabs.sendMessage(tab.id, { message: "clicked_browser_action" });
});

// Setup WebSocket or other background tasks
// const socket = new WebSocket('ws://example.com');

// Handle incoming WebSocket messages
// socket.onmessage = function(event) {
//     console.log('Message from server:', event.data);
// };

// You can add more listeners and functions as needed
