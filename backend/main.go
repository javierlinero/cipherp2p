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

func (s *SessionMap) AddUser(sessionId string, host bool, conn *websocket.Conn, userID string) {
	s.Mutex.Lock()
	defer s.Mutex.Unlock()
	log.Println("inserting new user into session: ", sessionId)
	if _, ok := s.Map[sessionId]; !ok {
		s.Map[sessionId] = []User{}
	}
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
	w.Header().Set("Content-Type", "application/json")
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

func (s *SessionMap) GetConnections(sessionID string) []*websocket.Conn {
	s.Mutex.RLock()
	defer s.Mutex.RUnlock()

	users, exists := s.Map[sessionID]
	if !exists {
		// Session does not exist, return an empty slice
		return []*websocket.Conn{}
	}

	var connections []*websocket.Conn
	for _, user := range users {
		connections = append(connections, user.Conn)
	}
	return connections
}

func JoinSessionRequestHandler(w http.ResponseWriter, r *http.Request) {
	wss, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("error upgrading connection: %v", err)
		return
	}

	sessionID := r.URL.Query().Get("sessionID")
	if sessionID == "" {
		log.Println("Session ID is missing")
		wss.Close()
		return
	}

	userID := uuid.New().String()[:8]
	Sessions.AddUser(sessionID, false, wss, userID)

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
				if Sessions.userIsHost(sessionID, userID) {
					// remove all users from the session and delete the session
					Sessions.closeSession(sessionID)
				} else {
					Sessions.removeUserFromSession(sessionID, userID)
					connections := Sessions.GetConnections(sessionID)
					allusers := Sessions.GetUsers(sessionID)
					serialized := UsersToSerialized(allusers)
					for _, conn := range connections {
						err := conn.WriteJSON(serialized)
						if err != nil {
							log.Printf("error sending message to connection: %v", err)
							return
						}
					}
				}
			}

			switch msg.Type {
			case "offer":
				//handle webrtc offer
			case "answer":
				//handle webrtc answer
			case "candidate":
				//handle webrtc ICE candidate
			case "joinSession":
				if msg.Host {
					// add the user to the session
					Sessions.UpdateUserHostStatus(msg.SessionID, userID, true)
					allusers := Sessions.GetUsers(msg.SessionID)
					serialized := UsersToSerialized(allusers)
					err := wss.WriteJSON(serialized)
					if err != nil {
						log.Printf("error sending user list: %v", err)
						return
					}
				} else {
					connections := Sessions.GetConnections(msg.SessionID)
					allusers := Sessions.GetUsers(msg.SessionID)
					serialized := UsersToSerialized(allusers)
					for _, conn := range connections {
						err := conn.WriteJSON(serialized)
						if err != nil {
							log.Printf("error sending message to connection: %v", err)
							return
						}
					}
				}
			case "leaveSession":
				if msg.Host {
					Sessions.removeUserFromSession(msg.SessionID, userID)
					// remove all users from the session and delete the session
					Sessions.closeSession(msg.SessionID)
				} else {
					Sessions.removeUserFromSession(msg.SessionID, userID)
					connections := Sessions.GetConnections(msg.SessionID)
					allusers := Sessions.GetUsers(msg.SessionID)
					serialized := UsersToSerialized(allusers)
					for _, conn := range connections {
						err := conn.WriteJSON(serialized)
						if err != nil {
							log.Printf("error sending message to connection: %v", err)
							return
						}
					}
				}
			}
		}
	}()
}

func (s *SessionMap) userIsHost(sessionID string, userID string) bool {
	s.Mutex.RLock() // Use RLock for reading
	defer s.Mutex.RUnlock()
	users, exists := s.Map[sessionID]
	if !exists {
		return false
	}
	for _, user := range users {
		if user.ID == userID {
			return user.Host
		}
	}
	return false
}

func (s *SessionMap) closeSession(sessionID string) {
	s.Mutex.Lock()
	defer s.Mutex.Unlock()

	users, exists := s.Map[sessionID]
	if !exists {
		return
	}

	for _, user := range users {
		if user.Conn != nil {
			user.Conn.Close()
		}
	}

	delete(s.Map, sessionID)
}

func (s *SessionMap) UpdateUserHostStatus(sessionId string, userID string, host bool) {
	s.Mutex.Lock()
	defer s.Mutex.Unlock()
	users, exists := s.Map[sessionId]
	if !exists {
		return
	}
	for i, user := range users {
		if user.ID == userID {
			users[i].Host = host
			break
		}
	}
}

func UsersToSerialized(users []User) []SerializableUser {
	var serializables []SerializableUser
	for _, user := range users {
		serializables = append(serializables, SerializableUser{user.ID, user.Host})
	}
	return serializables
}

func (s *SessionMap) removeUserFromSession(sessionID string, userID string) {
	s.Mutex.Lock()
	defer s.Mutex.Unlock()
	users, exists := s.Map[sessionID]
	if !exists {
		// Session does not exist
		return
	}

	for i, user := range users {
		if user.ID == userID {
			// Remove the user from the slice
			s.Map[sessionID] = append(users[:i], users[i+1:]...)
			return
		}
	}
	// User not found in the session
}

type SignalMessage struct {
	Type      string // offer, answer, candidate
	SessionID string // sessionID
	Host      bool   // host or not
}

func main() {
	Sessions.Initialize()
	port := os.Getenv("PORT")
	http.HandleFunc("/create-room", CreateSessionRequestHandler)
	http.HandleFunc("/join-room", JoinSessionRequestHandler)
	log.Println("Starting server on port:" + port)
	err := http.ListenAndServe(":"+port, nil)
	if err != nil {
		log.Println(err)
	}

}
