package notes

import (
	"cosmic-dolphin/utils"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/sirupsen/logrus"
)

func GetAllNotesHandler(w http.ResponseWriter, r *http.Request) {
	user := utils.GetUserFromContext(r.Context())

	notes, err := FetchAllNotes(user.ID)
	if err != nil {
		logrus.WithError(err).Error("Failed to fetch all notes")
		http.Error(w, "Failed to fetch all notes", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(notes); err != nil {
		logrus.WithError(err).Error("Failed to encode notes")
		http.Error(w, "Failed to encode notes", http.StatusInternalServerError)
	}
}

func GetNoteHandler(w http.ResponseWriter, r *http.Request) {
	user := utils.GetUserFromContext(r.Context())

	vars := mux.Vars(r)
	noteID, err := strconv.ParseInt(vars["id"], 10, 64)
	if err != nil {
		http.Error(w, "Invalid note ID", http.StatusBadRequest)
		return
	}

	notes, err := GetNoteByID(noteID, user.ID)
	if err != nil {
		logrus.WithError(err).Error("Failed to fetch notes")
		http.Error(w, "Failed to fetch notes", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(notes); err != nil {
		logrus.WithError(err).Error("Failed to encode notes")
		http.Error(w, "Failed to encode notes", http.StatusInternalServerError)
	}
}

type CreateNoteRequest struct {
	Body string `json:"body"`
	Type string `json:"type"`
}

func CreateNoteHandler(w http.ResponseWriter, r *http.Request) {
	user := utils.GetUserFromContext(r.Context())

	var req CreateNoteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	note, err := CreateNote(req.Body, NoteType(req.Type), user.ID)
	if err != nil {
		logrus.WithError(err).Error("Failed to create note")
		http.Error(w, "Failed to create note", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(note); err != nil {
		logrus.WithError(err).Error("Failed to encode note")
		http.Error(w, "Failed to encode note", http.StatusInternalServerError)
	}
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for simplicity
	},
}

func StreamNoteHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		logrus.Println("WebSocket upgrade failed:", err)
		return
	}
	defer conn.Close()

	vars := mux.Vars(r)
	noteID, err := strconv.ParseInt(vars["id"], 10, 64)
	if err != nil {
		http.Error(w, "Invalid note ID", http.StatusBadRequest)
		return
	}

	for {
		note, err := GetNoteByID(noteID, "921042b6-faa0-4343-9de6-2dab2eb06217")
		if err != nil {
			logrus.WithError(err).Error("Failed to fetch notes")
			http.Error(w, "Failed to fetch notes", http.StatusInternalServerError)
			return
		}

		stepStatus := make(map[string]CosmicJobStepStatus)
		for _, step := range note.Steps {
			if step.Status == CosmicJobStepStatusFailed {
				stepStatus[step.Key] = CosmicJobStepStatusFailed
			} else if step.Status == CosmicJobStepStatusComplete {
				if _, exists := stepStatus[step.Key]; !exists {
					stepStatus[step.Key] = CosmicJobStepStatusComplete
				}
			} else {
				stepStatus[step.Key] = step.Status
			}
		}

		allStepsComplete := true
		for _, status := range stepStatus {
			if status == CosmicJobStepStatusFailed {
				allStepsComplete = true
				break
			}
			if status != CosmicJobStepStatusComplete {
				allStepsComplete = false
				break
			}
		}

		if allStepsComplete {
			logrus.Info("All steps are complete or one of them failed")
			break
		}

		message := map[string]interface{}{
			"event": "note_created",
			"data":  note,
		}

		if err := conn.WriteJSON(message); err != nil {
			log.Println("WriteJSON error:", err)
			break
		}

		time.Sleep(1 * time.Second)
	}

	log.Println("WebSocket connection closed")
}
