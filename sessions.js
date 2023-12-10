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
        // websocket.send(JSON.stringify({ Type: 'joinSession', SessionID: sessionID }));
    }

    websocket.onmessage = function(event) {
        const data = JSON.parse(event.data);
        if (Array.isArray(data)) {
            updateUsersTable(data);
        }
    }

    // here we'll add other event listeners, so when someones websocket closes, we can see how many users are in a session, and if none then we can
    // delete the session
}

function updateUsersTable(data) {
    const usersTable = document.getElementById('usersTable');
    usersTable.innerHTML = '';

    data.forEach(user => {
        let row = usersTable.insertRow();
        let cell = row.insertCell();
        cell.textContent = user.ID;
    });
}


function fetchAndUpdateUsers(sessionID) {
    fetch(`https://damp-brushlands-64193-d1cbfc7ae5d4.herokuapp.com/get-session-users?sessionId=${sessionID}`)
    .then(response => response.json()) // Converts the response to JSON
    .then(users => {
        console.log(users); // Log the response to see what's being returned

        // Check if 'users' is null or empty
        if (!users || users.length === 0) {
            console.log("No users found or null response");
            return;
        }

        // Now 'users' should be the array from the JSON response
        const usersTable = document.getElementById('usersTable');
        users.forEach(user => {
            let row = usersTable.insertRow();
            let cell = row.insertCell();
            cell.textContent = user.ID; // Assuming user.ID is what you want to display
        });
    })
    .catch(error => console.error('Error:', error));
}