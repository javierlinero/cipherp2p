package main

import (
	"log"
	"net/http"
	"sync"

	"github.com/pion/webrtc/v3"
)

var peers = make(map[string]*webrtc.PeerConnection)
var mu sync.Mutex

func setupServer() {
	http.HandleFunc("/receive", handleReceive)
	http.HandleFunc("/send", handleSend)
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func createPeerConnection() (*webrtc.PeerConnection, error) {
	config := webrtc.Configuration{
		ICEServers: []webrtc.ICEServer{
			{
				URLs: []string{"stun:stun.1.google.com:19302"},
			},
		},
	}
	return webrtc.NewPeerConnection(config)
}

func setupDataChannel(peer *webrtc.PeerConnection) {
	dataChannel, err := peer.CreateDataChannel("fileTransfer", nil)
	if err != nil {
		return
	}
	dataChannel.OnOpen(func() {
		// data channel open -> file transfer/integrity check/setup
	})

	dataChannel.OnMessage(func(msg webrtc.DataChannelMessage) {
		// now handle incoming data
	})
}

func handleReceive(w http.ResponseWriter, r *http.Request) {
	return
}

func handleSend(w http.ResponseWriter, r *http.Request) {
	return
}

func encryptFileData(fileData []byte, key []byte) ([]byte, error) {
	return nil, nil
}

func decryptFileData(fileData []byte, key []byte) ([]byte, error) {
	return nil, nil
}

func transferFile(dataChannel *webrtc.DataChannel, fileData []byte) {
	return
}

func uploadToGoogleDrive(fileData []byte) error {
	return nil

}

func retrieveFromGoogleDrive(fileData []byte) error {
	return nil
}

func main() {
	setupServer()
}
