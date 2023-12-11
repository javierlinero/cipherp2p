document.addEventListener('DOMContentLoaded', function() {
    var inputField = document.getElementById('joinSessionIdInput');
    var submitButton = document.getElementById('submitJoinSession');

    // Disable submit button initially
    submitButton.disabled = true;

    inputField.addEventListener('input', function() {
        var value = inputField.value;
        value = value.replace(/[^0-9-]/g, '').replace(/-/g, ''); // Remove non-numeric characters and dashes

        if (value.length > 4) {
            value = value.slice(0, 4) + '-' + value.slice(4);
        }

        inputField.value = value; // Update the value of the input field

        if (value.length === 9) { // Check if the length is 9 (including the dash)
            submitButton.disabled = false; // Enable the submit button
        } else {
            submitButton.disabled = true; // Disable the submit button
        }
    });

    submitButton.addEventListener('click', function() {
        var sessionId = inputField.value;
        window.location.href = 'session.html?sessionID=' + sessionID + '&host=true';
        // Add your code here to handle the session ID
        // Optionally, clear the input field after submission
        // inputField.value = '';
    });
});
