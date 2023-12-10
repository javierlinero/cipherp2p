document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('createSession').addEventListener('click', function() {
        fetch('https://funny-cats-open.loca.lt/create-room') 
        .then(response => response.json())
        .then(sessionID => {
            window.location.href = 'session.html?sessionID=' + sessionID;
        })
        .catch(error => console.error('Error:', error));
    });
});