let peerConnections = {}; // Store multiple peer connections
const localDataChannels = {};

// Function to create a peer connection and data channel
function createPeerConnection(otherUserId) {
    const peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun1.l.google.com:19302' }]
    });

    // Handle ICE candidates
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            sendSignalMessage('candidate', { candidate: event.candidate, to: otherUserId });
        }
    };

    // Create a data channel
    const dataChannel = peerConnection.createDataChannel("fileChannel");
    localDataChannels[otherUserId] = dataChannel;

    setupDataChannelEvents(dataChannel);

    peerConnections[otherUserId] = peerConnection;
    return peerConnection;
}

// Setup data channel event handlers
function setupDataChannelEvents(dataChannel) {
    dataChannel.onopen = () => console.log("Data channel is open");
    dataChannel.onmessage = event => {
        // Handle incoming file data
    };
    dataChannel.onclose = () => console.log("Data channel is closed");
}

// Sending an offer to a newly connected user
function makeOffer(toUserId) {
    const peerConnection = createPeerConnection(toUserId);
    peerConnection.createOffer()
        .then(offer => peerConnection.setLocalDescription(offer))
        .then(() => {
            sendSignalMessage('offer', { sdp: peerConnection.localDescription, to: toUserId });
        });
}

// Handling received offer
function handleReceivedOffer(offer, fromUserId) {
    const peerConnection = createPeerConnection(fromUserId);
    peerConnection.setRemoteDescription(new RTCSessionDescription(offer.sdp))
        .then(() => peerConnection.createAnswer())
        .then(answer => peerConnection.setLocalDescription(answer))
        .then(() => {
            sendSignalMessage('answer', { sdp: peerConnection.localDescription, to: fromUserId });
        });
}

// Handling received answer
function handleReceivedAnswer(answer, fromUserId) {
    const peerConnection = peerConnections[fromUserId];
    if (peerConnection) {
        peerConnection.setRemoteDescription(new RTCSessionDescription(answer.sdp));
    }
}

// Handling received ICE candidate
function handleReceivedCandidate(candidate, fromUserId) {
    const peerConnection = peerConnections[fromUserId];
    if (peerConnection) {
        peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
}

// Send signaling message via WebSocket
function sendSignalMessage(type, data) {
    websocket.send(JSON.stringify({ Type: type, Data: data }));
}

// WebSocket message handler
websocket.onmessage = function(event) {
    const msg = JSON.parse(event.data);
    switch (msg.Type) {
        case 'offer':
            handleReceivedOffer(msg.Data, msg.From);
            break;
        case 'answer':
            handleReceivedAnswer(msg.Data, msg.From);
            break;
        case 'candidate':
            handleReceivedCandidate(msg.Data, msg.From);
            break;
        // Handle other message types (e.g., new user joined)
    }
};