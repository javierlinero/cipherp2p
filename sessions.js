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

let peerConnections = {}; // store multiple peer connections
const localDataChannels = {};

var websocket

function sendSignalMessage (sessionID, host, type, data) {
    const message = {
        Type: type,
        SessionID: sessionID, // Make sure this is defined in your scope
        Host: host, // This should be a boolean indicating if the sender is the host
        SDP: null,
        Candidate: null,
        To: null
    };

    // Add additional fields based on the message type
    if (type === 'offer' || type === 'answer') {
        message.SDP = data.sdp ? data.sdp : null;
    } else if (type === 'candidate') {
        message.Candidate = data.candidate ? data.candidate : null;
    }

    // Add the 'to' field for direct signaling messages if applicable
    if (data.to) {
        message.To = data.to;
    }

    // Send the message to the signaling server

    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify(message));
    }
}


function createPeerConnection(sessionID, host, otherUserId) {
    const peerConnection = new RTCPeerConnection({
        iceServers: [
            { urls: 'stun:stun.services.mozilla.com:3478' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' }
        ]
    });
    console.log('Created local peer connection object')

    // Handle ICE candidates
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            sendSignalMessage(sessionID, host, 'candidate', { candidate: event.candidate, to: otherUserId });
        }
    };

    // Create a data channel
    const dataChannel = peerConnection.createDataChannel("fileChannel");
    localDataChannels[otherUserId] = dataChannel;

    setupDataChannelEvents(dataChannel);

    peerConnections[otherUserId] = peerConnection;
    return peerConnection;
}

function setupDataChannelEvents(dataChannel) {
    dataChannel.onopen = () => console.log("Data channel is open");
    dataChannel.onmessage = event => {
        // Handle incoming file data
    };
    dataChannel.onclose = () => console.log("Data channel is closed");
}

function makeOffer(sessionID, host, toUserId) {
    const peerConnection = createPeerConnection(toUserId);
    peerConnection.createOffer()
        .then(offer => peerConnection.setLocalDescription(offer))
        .then(() => {
            console.log(typeof peerConnection.localDescription);
            sendSignalMessage(sessionID, host, 'offer', { sdp: peerConnection.localDescription, to: toUserId });
            console.log("Offer sent successfully.");
        });
}

function handleReceivedOffer(sessionID, host, SDP, fromUserId) {
    const peerConnection = createPeerConnection(fromUserId);
    peerConnection.setRemoteDescription(new RTCSessionDescription(SDP))
        .then(() => peerConnection.createAnswer())
        .then(answer => peerConnection.setLocalDescription(answer))
        .then(() => {
            sendSignalMessage(sessionID, host, 'answer', { sdp: peerConnection.localDescription, to: fromUserId });
            console.log("Received offer and sent answer")
        });
}

function handleReceivedAnswer(answer, fromUserId) {
    const peerConnection = peerConnections[fromUserId];
    if (peerConnection) {
        peerConnection.setRemoteDescription(new RTCSessionDescription(answer.sdp))
            .then(() => {
                console.log("Remote description set successfully for answer.");
            })
            .catch(error => {
                console.error("Error setting remote description: ", error);
            });
    }
}

function handleReceivedCandidate(candidate, fromUserId) {
    const peerConnection = peerConnections[fromUserId];
    if (peerConnection) {
        peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
            .then(() => {
                console.log("Successfully added ICE candidate.");
            })
            .catch(error => {
                console.error("Error adding ICE candidate: ", error);
            });
    }
}


function establishWebSocketConnection(sessionID, host) {
    websocket = new WebSocket(`wss://damp-brushlands-64193-d1cbfc7ae5d4.herokuapp.com/join-room?sessionID=${sessionID}`);

    websocket.onopen = function() {
        websocket.send(JSON.stringify({ Type: 'joinSession', SessionID: sessionID, Host: host, SDP: null, Candidate: null, To: null, From: null }));
    }

    websocket.onmessage = function(event) {
        const data = JSON.parse(event.data);
        if (typeof data === 'object' && Object.keys(data).length === 2) {
            updateUsersTable(data, sessionID, host);
        } else {
            switch (data.Type) {
                case 'offer':
                    handleReceivedOffer(sessionID, host, data.SDP, data.From);
                    break;
                case 'answer':
                    handleReceivedAnswer(data.SDP, data.From);
                    break;
                case 'candidate':
                    handleReceivedCandidate(data.Candidate, data.From);
                    break;
            }
        }
    }

    websocket.onclose = function() {
        console.log('Connection closed');
        window.location.href = 'closed.html'
    }

    websocket.onerror = function(error) {
        console.error('WebSocket error:', error);
        window.location.href = 'error.html'
    }

    var backButton = document.getElementById('back');

    backButton.addEventListener('click', function() {
        console.log('Back button clicked');
        if (websocket && websocket.readyState === WebSocket.OPEN) {
            console.log("closing?????")
            websocket.send(JSON.stringify({ Type: 'leaveSession', SessionID: sessionID, Host: host }));
        }
        window.location.href = 'index.html';
    });
    // here we'll add other event listeners, so when someones websocket closes, we can see how many users are in a session, and if none then we can
    // delete the session
}

function removeStringFromArray(data) {
    const stringToRemove = data.UserID;
    let array = data.Users;

    array = array.filter(item => item !== stringToRemove);

    return array;
}

function updateUsersTable(data, sessionID, host) {
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

    data.Users.forEach(user => {
        let row = usersTable.insertRow();

        let idCell = row.insertCell();
        idCell.textContent = user.ID;

        let roleCell = row.insertCell();
        roleCell.textContent = user.Host ? 'Host' : 'Participant';
    });
    if (!host) {
        const makeOfferArray = removeStringFromArray(data);
        makeOfferArray.forEach(userId => {
            makeOffer(sessionID, host, userId);
        });
    }
}

