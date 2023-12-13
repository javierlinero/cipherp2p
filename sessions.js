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

    // Attach the event listener to the file input for file selection
    const fileInput = document.getElementById('fileInput');

    // Attach the event listener to the "Send" button for sending the file
    const sendFileButton = document.getElementById('sendFileButton');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    sendFileButton.disabled = true;

    fileInput.addEventListener('change', function(event) {
        const file = event.target.files[0];
        // Log to check the file type and size
        console.log("EventListener: Selected file:", file.name, "Type:", file.type, "Size:", file.size);
        if (file) {

            // Update the UI to show the selected file name
            fileNameDisplay.textContent = `File selected: ${file.name}`;
            fileNameDisplay.style.display = 'block';

            // Enable the "Send" button because a file is selected
            sendFileButton.disabled = false;
        } else {
            // No file is selected, update the UI accordingly
            fileNameDisplay.textContent = 'No file selected.';
            fileNameDisplay.style.display = 'block';

            // Keep the "Send" button disabled
            sendFileButton.disabled = true;
        }
    });

    sendFileButton.addEventListener('click', sendFilesToCheckedUsers);

});

function sendFilesToCheckedUsers() {
    // Get the selected file from the file input
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    if (!file) {
        alert("Please select a file first.");
        return;
    }

    if (file.size > MAX_FILE_SIZE) {
        alert("File size exceeds the maximum limit of 10 MB.");
        return;
    }

    console.log("sendFilestoCheckedUsers: Selected file:", file.name, "Type:", file.type, "Size:", file.size);
    // Grab all the checkboxes that are checked
    const checkboxes = document.querySelectorAll('input[name="userCheckbox"]:checked');

    // Call the sendFileToUser function for each checked user
    checkboxes.forEach(checkbox => {
        const userId = checkbox.value;
        console.log('Sending file to user:', userId);
        sendFileToUser(file, userId);
    });
}

function sendFileToUser(file, userId) {
    console.log("sendFiletoUser: Selected file:", file.name, "Type:", file.type, "Size:", file.size);
    const dataChannel = localDataChannels[userId];
    if (dataChannel && dataChannel.readyState === 'open') {
        sendFileDataToUser(dataChannel, file);
    } else {
        console.error('Data channel not open or not found for user:', userId);
    }
}
function sendFileDataToUser(dataChannel, file) {
    sendFileMetadata(dataChannel, file); // Send the file metadata first

    dataChannel.bufferedAmountLowThreshold = 1024 * 1024; // Set low threshold to 1MB
    const chunkSize = 16384; // Define the size of each chunk (e.g., 16 KB)

    function readSlice() {
        const slice = file.slice(currentOffset, currentOffset + chunkSize);
        const reader = new FileReader();

        reader.onload = (e) => {
            dataChannel.send(e.target.result);
            currentOffset += slice.size; // Update the offset
            if (currentOffset < file.size) {
                if (dataChannel.bufferedAmount <= dataChannel.bufferedAmountLowThreshold) {
                    readSlice(); // Read next slice
                }
                // Otherwise, wait for the bufferedAmountLow event
            }
        };

        reader.onerror = (error) => {
            console.error('Error reading file:', error);
        };

        reader.readAsArrayBuffer(slice);
    }

    readSlice(); // Start reading the first slice

    dataChannel.onbufferedamountlow = () => {
        if (currentOffset < file.size) {
            readSlice(); // Send next slice
        }
    };
}


// Modify your setupDataChannelEvents to handle receiving file data
function setupDataChannelEvents(dataChannel) {
    dataChannel.onopen = () => {
        console.log("Data channel is open");
        processMessageQueue(dataChannel); // Process any queued messages
      };
    dataChannel.onmessage = event => {
        if (typeof event.data === 'string' && !metadataReceived) {
            // The first message should be the metadata
            fileMetadata = JSON.parse(event.data);
            metadataReceived = true;
            fileSize = fileMetadata.size;
            console.log(`Expecting file: ${fileMetadata.name} with size: ${fileMetadata.size}`);
        } else {
            // Here we receive the file data
            receivedBuffers.push(event.data);
            receivedSize += event.data.byteLength;
            console.log(`Received chunk: ${event.data.byteLength} bytes, total received: ${receivedSize} bytes`);

            // Check if file is fully received
            if (receivedSize === fileSize) {
                const blob = new Blob(receivedBuffers, { type: fileMetadata.type });
                downloadBlob(blob, fileMetadata.name);
                // Reset for the next file transfer
                receivedBuffers = [];
                fileSize = 0;
                receivedSize = 0;
                metadataReceived = false;
                fileMetadata = null;
            }
        }
    };
    dataChannel.onclose = () => console.log("Data channel is closed");
    dataChannel.onerror = () => console.error("Data channel encountered an error");
}

function downloadBlob(blob, fileName) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click(); // Trigger the download
    // Clean up the URL object after the download starts
    link.addEventListener('click', () => URL.revokeObjectURL(link.href), {once: true});
}

function sendFileMetadata(dataChannel, file) {
    const metadata = {
      name: file.name,
      size: file.size,
      type: file.type
    };
    sendDataChannelMessage(dataChannel, JSON.stringify(metadata));
  }

  function sendDataChannelMessage(dataChannel, message) {
    if (dataChannel.readyState === 'open') {
        if (dataChannel.bufferedAmount > 16 * 1024 * 1024) { // Check if buffered amount is greater than a threshold, e.g., 16 MB
            setTimeout(() => sendDataChannelMessage(dataChannel, message), 200); // Wait for 200 ms before trying to send again
        } else {
            dataChannel.send(message);
        }
    } else {
        // unable to send message
        console.error("Data channel is not open. Unable to send message.");
    }
}

function processMessageQueue(dataChannel) {
    while (messageQueue.length > 0 && dataChannel.readyState === 'open') {
        const message = messageQueue.shift(); // Remove the first message from the queue
        dataChannel.send(message);
    }
}

function downloadBlob(blob, fileName) {
    // Create a link element
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link); // Append to the body
    link.click(); // Trigger the download
    document.body.removeChild(link); // Clean up
}

let messageQueue = []; // Queue to store messages that need to be sent when the data channel opens
let receivedBuffers = []; // initialized to an empty array
let fileSize = 0;
let receivedSize = 0;
let metadataReceived = false;
let fileMetadata = null;
let peerConnections = {}; // store multiple peer connections
let currentOffset = 0;
const localDataChannels = {};
const MAX_FILE_SIZE = 10 * 1024 * 1024; //10 MB
var loggedInUser = null;
var websocket
var sentOffer = false;

function sendSignalMessage (sessionID, host, type, data) {
    const message = {
        Type: type,
        SessionID: sessionID, // Make sure this is defined in your scope
        Host: host, // This should be a boolean indicating if the sender is the host
        SDP: null,
        Candidate: null, 
        To: null,
        From: null
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

    if(data.from) {
        message.From = data.from
    }

    // Send the message to the signaling server

    if (websocket && websocket.readyState === WebSocket.OPEN) {
        console.log(message.To);
        websocket.send(JSON.stringify(message));
    }
}


function createPeerConnection(sessionID, isInitiator, host, otherUserId, toUserId) {
    var peerConfiguration = { iceServers: [
        { urls: 'stun:stun.services.mozilla.com:3478' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
    ]};

    //(async() => {
    //    const response = await fetch("https://cipherp2p.metered.live/api/v1/turn/credentials?apiKey=2f6ed535e91572534639472ac71a467669d2");
    //    const iceServers = await response.json();
    //    peerConfiguration.iceServers = iceServers
    //  })();
    
    const peerConnection = new RTCPeerConnection(peerConfiguration);
    console.log('Created local peer connection object')

    // Handle ICE candidates
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            sendSignalMessage(sessionID, host, 'candidate', { candidate: JSON.stringify(event.candidate), to: otherUserId, from: toUserId});
        }
    };

    if (isInitiator) {
        // This peer is the initiator, so create a data channel
        const dataChannel = peerConnection.createDataChannel("fileChannel");
        localDataChannels[otherUserId] = dataChannel;
        setupDataChannelEvents(dataChannel);
    } else {
        // This peer is not the initiator, so listen for the data channel
        peerConnection.ondatachannel = function(event) {
            const dataChannel = event.channel;
            localDataChannels[otherUserId] = dataChannel;
            setupDataChannelEvents(dataChannel);
        };
    }


    peerConnections[otherUserId] = peerConnection;
    return peerConnection;
}

async function makeOffer(sessionID, host, toUserId, fromUserId) {
    try {
        const peerConnection = createPeerConnection(sessionID, true, host, toUserId, fromUserId);
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        sendSignalMessage(sessionID, host, 'offer', { sdp: JSON.stringify(peerConnection.localDescription), to: toUserId, from: fromUserId });
        console.log("Offer sent successfully to user:", toUserId);
    } catch (error) {
        console.error("Error in makeOffer:", error);
    }
}

async function handleReceivedOffer(sessionID, host, SDP, fromUserId, toUserId) {
    try {
        const peerConnection = createPeerConnection(sessionID, false, host, fromUserId, toUserId);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(SDP)));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        sendSignalMessage(sessionID, host, 'answer', { sdp: JSON.stringify(peerConnection.localDescription), to: fromUserId, from: toUserId });
        console.log("Received offer from user:", fromUserId, "and sent answer");
    } catch (error) {
        console.error("Error in handleReceivedOffer:", error);
    }
}

async function handleReceivedAnswer(answer, fromUserId) {
    const peerConnection = peerConnections[fromUserId];
    if (peerConnection) {
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(JSON.parse(answer)));
            console.log("Remote description set successfully for answer from user:", fromUserId);
        } catch (error) {
            console.error("Error setting remote description for answer:", error);
        }
    }
}

async function handleReceivedCandidate(candidate, fromUserId) {
    const peerConnection = peerConnections[fromUserId];
    if (peerConnection) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(JSON.parse(candidate)));
            console.log("Successfully added ICE candidate from user:", fromUserId);
        } catch (error) {
            console.error("Error adding ICE candidate:", error);
        }
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
            if (loggedInUser === null) {
                loggedInUser = data.UserID;
            }
            updateUsersTable(data, sessionID, host);
        } else {
            switch (data.Type) {
                case 'offer':
                    handleReceivedOffer(sessionID, host, data.SDP, data.From, data.To);
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

    array = array.filter(item => item.ID !== stringToRemove);

    return array;
}

function updateUsersTable(data, sessionID, host) {
    const usersTable = document.getElementById('usersTable');
    // Clear the entire table
    usersTable.innerHTML = '';

    let headerRow = usersTable.insertRow();
    let idHeaderCell = headerRow.insertCell();
    idHeaderCell.textContent = 'User ID';
    idHeaderCell.style.fontWeight = 'bold';

    let roleHeaderCell = headerRow.insertCell();
    roleHeaderCell.textContent = 'Role';
    roleHeaderCell.style.fontWeight = 'bold'; 

    let checkBoxHeaderCell = headerRow.insertCell();
    checkBoxHeaderCell.textContent = 'Send Files';
    checkBoxHeaderCell.style.fontWeight = 'bold'; 


    data.Users.forEach(user => {
        let row = usersTable.insertRow();

        let idCell = row.insertCell();
        idCell.textContent = user.ID;

        let roleCell = row.insertCell();
        roleCell.textContent = user.Host ? 'Host' : 'Participant';

        if (user.ID !== loggedInUser) {
            let checkBoxCell = row.insertCell();
            let checkboxDiv = document.createElement('div'); // Create a div to wrap the checkbox
            checkboxDiv.classList.add('checkbox-container'); // Add a class for styling
            
            let checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = user.ID;
            checkbox.name = 'userCheckbox';
            
            checkboxDiv.appendChild(checkbox); // Append the checkbox to the div
            checkBoxCell.appendChild(checkboxDiv); // Append the div to the cell
        
        } else {
            row.insertCell();
        }
    });

    if (!host && !sentOffer) {
        const makeOfferArray = removeStringFromArray(data);
        makeOfferArray.forEach(userId => {
            console.log(userId)
            console.log(typeof userId)
            makeOffer(sessionID, host, userId.ID, data.UserID); // sessionid, host or not, to userid, from data.UserID
        });
    }
}

