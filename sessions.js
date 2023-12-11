document.addEventListener('DOMContentLoaded', function() {
    // Extract session ID from URL
    const params = new URLSearchParams(window.location.search);
    let sessionID = params.get('sessionID');
    const host = params.get('host') === 'true';

    // Format sessionID with a dash
    if (sessionID && sessionID.length === 8) {
        sessionIDSplit = sessionID.slice(0, 4) + '-' + sessionID.slice(4);
    }

    // Display the formatted session ID
    document.getElementById('sessionIdDisplay').textContent = sessionIDSplit;

    establishWebSocketConnection(sessionID, host);
});


function establishWebSocketConnection(sessionID, host) {
    const websocket = new WebSocket(`wss://damp-brushlands-64193-d1cbfc7ae5d4.herokuapp.com/join-room`);

    websocket.onopen = function() {
        websocket.send(JSON.stringify({ Type: 'joinSession', SessionID: sessionID, Host: host }));
    }

    websocket.onmessage = function(event) {
        const data = JSON.parse(event.data);
        if (Array.isArray(data)) {
            updateUsersTable(data);
        }
    }

    websocket.onclose = function() {
        console.log('Connection closed');
    }

    websocket.onerror = function(error) {
        console.error('WebSocket error:', error);
    }
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

