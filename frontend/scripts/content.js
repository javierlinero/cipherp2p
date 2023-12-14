// Listen for messages from the background script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === "clicked_browser_action") {
        // Perform some action when the browser action icon is clicked
        console.log("Browser action icon clicked!");
    }
});

// Example function to interact with the current page
function changeBackgroundColor(color) {
    document.body.style.backgroundColor = color;
}

// Listen for a specific message to change background color
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.command === "changeColor") {
        changeBackgroundColor(request.color);
    }
});
