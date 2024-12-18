package job

import (
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for simplicity
	},
}

func StreamJobHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("WebSocket upgrade failed:", err)
		return
	}
	defer conn.Close()

	for i := int64(1); i <= 10; i++ {
		text := "Note Title " + time.Now().Format("15:04:05")

		message := map[string]interface{}{
			"event": "note_created",
			"data":  text,
		}

		if err := conn.WriteJSON(message); err != nil {
			log.Println("WriteJSON error:", err)
			break
		}

		time.Sleep(2 * time.Second)
	}

	log.Println("WebSocket connection closed")
}
