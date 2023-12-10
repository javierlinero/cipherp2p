document.addEventListener('DOMContentLoaded', function() {
    // Extract session ID from URL
    const params = new URLSearchParams(window.location.search);
    const sessionID = params.get('sessionID');

    // Display the session ID
    document.getElementById('sessionIdDisplay').textContent = sessionID;

    establishWebSocketConnection(sessionID);
});


function establishWebSocketConnection(sessionID) {
    const websocket = new WebSocket(`wss://damp-brushlands-64193-d1cbfc7ae5d4.herokuapp.com/join-room?sessionID=${sessionID}`);

    websocket.onopen = function() {
        websocket.send(JSON.stringify({ Type: 'joinSession', SessionID: sessionID }));
    }

    websocket.onmessage = function(event) {
        const data = JSON.parse(event.data);
        if (Array.isArray(data)) {
            updateUsersTable(data);
        }
    }

    websocket.onclose = function() {
        websocket.send(JSON.stringify({ Type: 'leaveSession', SessionID: sessionID }));
    }

    // here we'll add other event listeners, so when someones websocket closes, we can see how many users are in a session, and if none then we can
    // delete the session
}

function updateUsersTable(data) {
    const usersTable = document.getElementById('usersTable');
    // Clear the entire table
    usersTable.innerHTML = '';

    // Create and add the header row
    let headerRow = usersTable.insertRow();
    let headerCell = headerRow.insertCell();
    headerCell.textContent = 'User ID';
    headerCell.style.fontWeight = 'bold'; // Optional, for styling the header

    data.forEach(user => {
        let row = usersTable.insertRow();
        let cell = row.insertCell();
        cell.textContent = user.ID;
    });
}

