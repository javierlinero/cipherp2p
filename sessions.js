document.addEventListener('DOMContentLoaded', function() {
    // Extract session ID from URL
    const params = new URLSearchParams(window.location.search);
    const sessionID = params.get('sessionID');

    // Display the session ID
    document.getElementById('sessionIdDisplay').textContent = sessionID;

    establishWebSocketConnection(sessionID);

    fetchAndUpdateUsers(sessionID);
});


function establishWebSocketConnection(sessionID) {
    const websocket = new WebSocket('wss://damp-brushlands-64193-d1cbfc7ae5d4.herokuapp.com/join-room');

    websocket.onopen = function() {
        websocket.send(JSON.stringify({ Type: 'joinSession', SessionID: sessionID }));
    }

    // here we'll add other event listeners, so when someones websocket closes, we can see how many users are in a session, and if none then we can
    // delete the session
}

function fetchAndUpdateUsers(sessionID) {
    fetch(`https://damp-brushlands-64193-d1cbfc7ae5d4.herokuapp.com/get-session-users?sessionId=${sessionID}`)
    .then(response => response.json())
    .then(users => {
        const usersTable = document.getElementById('usersTable');
        users.forEach(user => {
            let row = usersTable.insertRow();
            let cell = row.insertCell();
            cell.textContent = user.Conn ? user.Conn.RemoteAddr().String() : 'Disconnected'; // Or use another user identifier
        });
    })
    .catch(error => console.error('Error:', error));
}