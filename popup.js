document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('createSession').addEventListener('click', function() {
        fetch('https://damp-brushlands-64193-d1cbfc7ae5d4.herokuapp.com/create-room') 
        .then(response => {
            if (response.headers.get('content-type').includes('application/json')) {
                return response.json();
            } else {
                throw new Error('Not a JSON response');
            }
        })
        .then(sessionID => {
            window.location.href = 'session.html?sessionID=' + sessionID + '&host=true';
        })
        .catch(error => console.error('Error:', error));
    });
});