package main

import (
	"encoding/json"
	"log"
	"math/rand"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type User struct {
	Host bool
	Conn *websocket.Conn
}

type SessionMap struct {
	Mutex sync.RWMutex
	Map   map[string][]User
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
	s.Mutex.Lock()
	defer s.Mutex.Unlock()
	log.Println("inserting new user into session: ", sessionId)
	s.Map[sessionId] = append(s.Map[sessionId], User{host, conn})
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
	}
	Sessions.AddUser(sessionID, false, wss)

	go func() {
		for {
			var msg SignalMessage
			err := wss.ReadJSON(&msg)
			if err != nil {
				log.Println("reading/retrieving error: ", err)
				break
			}
			handleSignalMessage(msg, sessionID)
		}
	}()
}

func handleSignalMessage(msg SignalMessage, sessionID string) {
	for _, user := range Sessions.GetUsers(sessionID) {
		if user.Conn != nil {
			err := user.Conn.WriteJSON(msg)
			if err != nil {
				log.Println("writing/sending error: ", err)
			}
		}
	}
}

type SignalMessage struct {
	Type string          // offer, answer, candidate
	Data json.RawMessage // Raw JSON message content
	To   string          // Session ID of the recipient
}

func main() {
	Sessions.Initialize()
	port := os.Getenv("PORT")
	http.HandleFunc("/create-room", CreateSessionRequestHandler)
	http.HandleFunc("/join-room", JoinSessionRequestHandler)
	log.Println("Starting server on port:" + port)
	err := http.ListenAndServe(":"+port, nil)
	if err != nil {
		log.Fatal(err)
	}

}
