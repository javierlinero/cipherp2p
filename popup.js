document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('createSession').addEventListener('click', function() {
        fetch('https://damp-brushlands-64193-d1cbfc7ae5d4.herokuapp.com/create-room') 
        .then(response => response.json())
        .then(sessionID => {
            window.location.href = 'session.html?sessionID=' + sessionID;
        })
        .catch(error => console.error('Error:', error));
    });
});