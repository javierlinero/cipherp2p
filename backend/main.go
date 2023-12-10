package main

import (
	"encoding/json"
	"log"
	"math/rand"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type User struct {
	ID   string
	Host bool
	Conn *websocket.Conn
}

type SerializableUser struct {
	ID   string
	Host bool
}

type SessionMap struct {
	Mutex sync.RWMutex
	Map   map[string][]User
}

func generateUniqueID() string {
	return uuid.New().String()
}

func (s *SessionMap) Initialize() {
	s.Map = make(map[string][]User)
}

func (s *SessionMap) GetUsers(sessionId string) []User {
	s.Mutex.RLock()
	defer s.Mutex.RUnlock()
	return s.Map[sessionId]
}

// create a new session id and add it to the hashmap of sessions
func (s *SessionMap) MakeSession() string {
	s.Mutex.Lock()
	defer s.Mutex.Unlock()

	rand.New(rand.NewSource(time.Now().UnixNano()))
	var SessionLetters = []rune("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890")

	lenSess := make([]rune, 8)
	for i := 0; i < 8; i++ {
		lenSess[i] = SessionLetters[rand.Intn(len(SessionLetters))]
	}
	sessionId := string(lenSess)

	s.Map[sessionId] = make([]User, 0)
	return sessionId
}

func (s *SessionMap) AddUser(sessionId string, host bool, conn *websocket.Conn) {
	userID := generateUniqueID()
	s.Mutex.Lock()
	defer s.Mutex.Unlock()
	log.Println("inserting new user into session: ", sessionId)
	s.Map[sessionId] = append(s.Map[sessionId], User{userID, host, conn})
}

func (s *SessionMap) DeleteSession(sessionId string) {
	s.Mutex.Lock()
	defer s.Mutex.Unlock()
	delete(s.Map, sessionId)
}

var Sessions SessionMap

func CreateSessionRequestHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	sessionID := Sessions.MakeSession()

	log.Println("created session: ", sessionID)
	log.Println("*---------------------------*")
	log.Println("Active Sessions:", Sessions.Map)
	json.NewEncoder(w).Encode(sessionID)

}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func JoinSessionRequestHandler(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Query().Get("sessionId")

	wss, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Fatalf("error upgrading connection: %v", err)
		return
	}

	Sessions.AddUser(sessionID, false, wss)

	users := Sessions.GetUsers(sessionID)

	// Convert to a slice of SerializableUser (or similar structure)
	var serializables []SerializableUser
	for _, user := range users {
		serializables = append(serializables, SerializableUser{user.ID, user.Host})
	}

	// Send the list of users back to the frontend
	err = wss.WriteJSON(serializables)
	if err != nil {
		log.Printf("error sending user list: %v", err)
		return
	}

	go func() {
		defer wss.Close()
		for {
			var msg SignalMessage
			err := wss.ReadJSON(&msg)
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("WebSocket error: %v", err)
				} else {
					log.Println("WebSocket closed")
				}
				break
			}

			switch msg.Type {
			case "offer":
				//handle webrtc offer
			case "answer":
				//handle webrtc answer
			case "candidate":
				//handle webrtc ICE candidate
			case "joinSession":
				Sessions.AddUser(sessionID, false, wss)
			}
		}
	}()
}

func GetSessionUsersHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	sessionID := r.URL.Query().Get("sessionId")

	users := Sessions.GetUsers(sessionID)

	var serializables []SerializableUser
	for _, user := range users {
		serializables = append(serializables, SerializableUser{user.ID, user.Host})
	}

	// You might need to create a simpler structure if User contains unexportable or unnecessary fields
	json.NewEncoder(w).Encode(serializables)
}

type SignalMessage struct {
	Type      string // offer, answer, candidate
	SessionID string // sessionID
}

func main() {
	Sessions.Initialize()
	port := os.Getenv("PORT")
	http.HandleFunc("/create-room", CreateSessionRequestHandler)
	http.HandleFunc("/get-session-users", GetSessionUsersHandler)
	http.HandleFunc("/join-room", JoinSessionRequestHandler)
	log.Println("Starting server on port:" + port)
	err := http.ListenAndServe(":"+port, nil)
	if err != nil {
		log.Fatal(err)
	}

}
