package knowledge

import (
	"cosmic-dolphin/utils"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"
)

func GetAllNotesHandler(w http.ResponseWriter, r *http.Request) {
	user := utils.GetUserFromContext(r.Context())

	notes, err := getAllNotes(user.ID)
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

	notes, err := getNoteByID(noteID, user.ID)
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
