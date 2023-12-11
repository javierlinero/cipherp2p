document.addEventListener('DOMContentLoaded', function() {
    // Extract session ID from URL
    const params = new URLSearchParams(window.location.search);
    let sessionID = params.get('sessionID'); // Use let instead of const
    const host = params.get('host') === 'true';

    let sessionIDSplit = sessionID; // Declare sessionIDSplit variable

    // Format sessionID with a dash if it has the correct length
    if (sessionID && sessionID.length === 8) {
        sessionIDSplit = sessionID.slice(0, 4) + '-' + sessionID.slice(4);
    }

    // Display the formatted session ID
    document.getElementById('sessionIdDisplay').textContent = sessionIDSplit;


    var sessionIdDisplay = document.getElementById('sessionIdDisplay');
    var copyFeedback = document.getElementById('copyFeedback');

    sessionIdDisplay.addEventListener('click', function() {
        navigator.clipboard.writeText(sessionID).then(function() {
            // Success feedback
            copyFeedback.textContent = 'Session ID Copied!';
            copyFeedback.style.display = 'block';
            setTimeout(function() {
                copyFeedback.style.display = 'none';
            }, 2000); // Hide the feedback message after 2 seconds
        }).catch(function(err) {
            // Error handling
            copyFeedback.textContent = 'Failed to copy';
            console.error('Error in copying text: ', err);
        });
    });

    establishWebSocketConnection(sessionID, host);
});



function establishWebSocketConnection(sessionID, host) {
    const websocket = new WebSocket(`wss://damp-brushlands-64193-d1cbfc7ae5d4.herokuapp.com/join-room?sessionID=${sessionID}`);

    websocket.onopen = function() {
        websocket.send(JSON.stringify({ Type: 'joinSession', SessionID: sessionID, Host: host }));
    }

    websocket.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
    
            // First, check if data is an object with a 'type' property
            if (typeof data === 'object' && data !== null && 'type' in data) {
                if (data.type === 'sessionClosed') {
                    window.location.href = 'closed.html';
                    return; // Exit the function after handling
                }
                // Add more conditions here for different types of messages
            }
            // Then check if data is an array
            else if (Array.isArray(data)) {
                updateUsersTable(data);
            }
        } catch (error) {
            console.error("Error parsing WebSocket message:", error);
            // Handle parsing error
        }
    }

    websocket.onclose = function() {
        console.log('Connection closed');
    }

    websocket.onerror = function(error) {
        console.error('WebSocket error:', error);
    }

    var backButton = document.getElementById('back');

    backButton.addEventListener('click', function() {
        console.log('Back button clicked');
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify({ Type: 'leaveSession', SessionID: sessionID, Host: host }));
        }
        window.location.href = 'index.html';
    });
    // here we'll add other event listeners, so when someones websocket closes, we can see how many users are in a session, and if none then we can
    // delete the session
}

function updateUsersTable(data) {
    const usersTable = document.getElementById('usersTable');
    // Clear the entire table
    usersTable.innerHTML = '';

    let headerRow = usersTable.insertRow();
    let idHeaderCell = headerRow.insertCell();
    idHeaderCell.textContent = 'User ID';
    idHeaderCell.style.fontWeight = 'bold'; // Optional, for styling the header

    let roleHeaderCell = headerRow.insertCell();
    roleHeaderCell.textContent = 'Role';
    roleHeaderCell.style.fontWeight = 'bold'; // Optional, for styling the header

    data.forEach(user => {
        let row = usersTable.insertRow();

        let idCell = row.insertCell();
        idCell.textContent = user.ID;

        let roleCell = row.insertCell();
        roleCell.textContent = user.Host ? 'Host' : 'Participant';
    });
}

