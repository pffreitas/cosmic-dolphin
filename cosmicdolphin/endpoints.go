package cosmicdolphin

import (
	"context"
	"cosmic-dolphin/utils"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"
)

// Knowledge endpoints (from knowledge package)

func runKnowledgePipelineAndStream(ctx context.Context, userID string, rawURL string, noteID int64, cosmicStreamHandler *CosmicStreamHandler) error {

	// Add timeout to prevent long-running operations
	ctx, cancel := context.WithTimeout(ctx, 15*time.Minute)
	defer cancel()

	_, err := GetNoteByID(noteID, userID)
	if err != nil {
		cosmicStreamHandler.OnError(err)
		return err
	}

	// Send initial progress message
	cosmicStreamHandler.OnToken("Starting document processing...")

	err = RunSummaryAgent(ctx, rawURL, noteID, userID, cosmicStreamHandler)

	if err != nil {
		cosmicStreamHandler.OnError(err)
		return err
	}

	logrus.Info("Cosmic agent completed, sending progress messages...")

	// Send progress messages after the agent completes
	cosmicStreamHandler.OnToken("Document summarized.")
	logrus.Info("Sent: Document summarized.")

	// Check for cancellation
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	cosmicStreamHandler.OnToken("Note updated.")
	logrus.Info("Sent: Note updated.")

	cosmicStreamHandler.OnToken("Knowledge pipeline completed successfully.")
	logrus.Info("Sent: Knowledge pipeline completed successfully.")

	// Send final completion

	logrus.Info("Sent final completion.")

	return nil
}

func AddToKnowledge(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	cosmicStreamHandler := NewCosmicStreamHandler(make(chan LLMToken))

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported!", http.StatusInternalServerError)
		return
	}

	ctx := r.Context()

	user := utils.GetUserFromContext(r.Context())
	if user == nil {
		http.Error(w, "could not get user from context", http.StatusUnauthorized)
		return
	}

	url := r.URL.Query().Get("url")
	if url == "" {
		http.Error(w, "url parameter is required", http.StatusBadRequest)
		return
	}

	noteIDParam := r.URL.Query().Get("noteId")
	if noteIDParam == "" {
		http.Error(w, "noteId parameter is required", http.StatusBadRequest)
		return
	}

	noteID, err := strconv.ParseInt(noteIDParam, 10, 64)
	if err != nil {
		http.Error(w, "noteId parameter is invalid", http.StatusBadRequest)
		return
	}

	go func() {
		defer close(cosmicStreamHandler.ResponseChan)
		runKnowledgePipelineAndStream(ctx, user.ID, url, noteID, cosmicStreamHandler)
	}()

	for response := range cosmicStreamHandler.ResponseChan {
		data, err := json.Marshal(response)
		if err != nil {
			logrus.WithError(err).Error("Error marshaling response")
			continue
		}

		_, err = w.Write([]byte("data: " + string(data) + "\n\n"))
		if err != nil {
			logrus.WithError(err).Error("Error writing SSE message")
			return
		}

		flusher.Flush()

		if response.Done {
			break
		}
	}
}

// Notes endpoints (from notes package)

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

type NoteResponse struct {
	Note
	Resources []Resource `json:"resources"`
}

func GetNoteHandler(w http.ResponseWriter, r *http.Request) {
	user := utils.GetUserFromContext(r.Context())

	vars := mux.Vars(r)
	noteID, err := strconv.ParseInt(vars["id"], 10, 64)
	if err != nil {
		http.Error(w, "Invalid note ID", http.StatusBadRequest)
		return
	}

	note, err := GetNoteByID(noteID, user.ID)
	if err != nil {
		logrus.WithError(err).Error("Failed to fetch notes")
		http.Error(w, "Failed to fetch notes", http.StatusInternalServerError)
		return
	}

	resources, err := GetResourcesByNoteID(noteID)
	if err != nil {
		logrus.WithError(err).Error("Failed to fetch resources")
		http.Error(w, "Failed to fetch resources", http.StatusInternalServerError)
		return
	}

	noteResponse := NoteResponse{
		Note:      *note,
		Resources: resources,
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(noteResponse); err != nil {
		logrus.WithError(err).Error("Failed to encode notes")
		http.Error(w, "Failed to encode notes", http.StatusInternalServerError)
	}
}

type CreateNoteRequest struct {
	Body string `json:"body"`
}

func CreateNoteHandler(w http.ResponseWriter, r *http.Request) {
	user := utils.GetUserFromContext(r.Context())

	var req CreateNoteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	if req.Body == "" {
		req.Body = ""
	}

	note, err := CreateNote(req.Body, NoteTypeNote, user.ID)
	if err != nil {
		logrus.WithError(err).Error("Failed to create note")
		http.Error(w, "Failed to create note", http.StatusInternalServerError)
		return
	}

	noteResponse := NoteResponse{
		Note:      *note,
		Resources: []Resource{},
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	if err := json.NewEncoder(w).Encode(noteResponse); err != nil {
		logrus.WithError(err).Error("Failed to encode note")
		http.Error(w, "Failed to encode note", http.StatusInternalServerError)
	}
}

type AddToCosmicHeapRequest struct {
	Body string `json:"body"`
}
