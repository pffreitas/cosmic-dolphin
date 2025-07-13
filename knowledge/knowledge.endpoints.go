package knowledge

import (
	"cosmic-dolphin/llm"
	"cosmic-dolphin/utils"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/sirupsen/logrus"
)

func AddToKnowledge(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	responseChan := make(chan llm.LLMToken)

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
		if err := runKnowledgePipelineAndStream(ctx, user.ID, url, noteID, responseChan); err != nil {
			logrus.WithError(err).Error("Error in knowledge pipeline stream")
			return
		}
	}()

	for response := range responseChan {
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
