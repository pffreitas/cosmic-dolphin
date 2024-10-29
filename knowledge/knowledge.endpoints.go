package knowledge

import (
	"encoding/json"
	"net/http"
	"time"
)

func HandleInsertResource(w http.ResponseWriter, r *http.Request) {
	var requestBody struct {
		Type   ResourceType `json:"type"`
		Source string       `json:"source"`
		UserID string       `json:"user_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	resource := Resource{
		Type:      requestBody.Type,
		Source:    requestBody.Source,
		CreatedAt: time.Now(),
		UserID:    requestBody.UserID,
	}

	processResource(resource)
}
