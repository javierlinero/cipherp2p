document.addEventListener('DOMContentLoaded', function() {
    var inputField = document.getElementById('joinSessionIdInput');
    var submitButton = document.getElementById('submitJoinSession');

    // Disable submit button initially
    submitButton.disabled = true;

    inputField.addEventListener('input', function() {
        var value = inputField.value;

        // Allow only alphanumeric characters and remove dashes (except the one we add)
        value = value.replace(/[^0-9a-zA-Z-]/g, '').replace(/(?!^)-/g, '');

        // Add a dash after the fourth character if not already present
        if (value.length > 4 && value[4] !== '-') {
            value = value.slice(0, 4) + '-' + value.slice(4);
        }

        // Update the input field only if the value has changed
        // to avoid losing the cursor position
        if (inputField.value !== value) {
            inputField.value = value;
        }

        // Enable the submit button if the length is exactly 9 (including dash)
        submitButton.disabled = value.length !== 9;
    });

    submitButton.addEventListener('click', function() {
        var sessionId = inputField.value.replace(/-/g, ''); // Remove all dashes
        // Redirect to the session page with the session ID and host parameters
        window.location.href = 'session.html?sessionID=' + sessionId + '&host=true';
    });
});
