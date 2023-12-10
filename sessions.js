document.addEventListener('DOMContentLoaded', function() {
    // Extract session ID from URL
    const params = new URLSearchParams(window.location.search);
    const sessionID = params.get('sessionID');

    // Display the session ID
    document.getElementById('sessionIdDisplay').textContent = sessionID;

    // Fetch and display users
    fetch(`https://damp-brushlands-64193-d1cbfc7ae5d4.herokuapp.com/get-session-users?sessionId=${sessionID}`)
    .then(response => response.json())
    .then(users => {
        const usersTable = document.getElementById('usersTable');
        users.forEach(user => {
            let row = usersTable.insertRow();
            let cell = row.insertCell();
            cell.textContent = user.Conn ? user.Conn.RemoteAddr().String() : 'Disconnected'; // Or any other user identifier
        });
    })
    .catch(error => console.error('Error:', error));
});