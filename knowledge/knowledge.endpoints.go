package knowledge

import (
	"cosmic-dolphin/utils"
	"encoding/json"
	"net/http"
	"time"
)

func HandleInsertResource(w http.ResponseWriter, r *http.Request) {
	user := utils.GetUserFromContext(r.Context())
	if user == nil {
		http.Error(w, "User not found in context", http.StatusUnauthorized)
		return
	}

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
		UserID:    user.ID,
	}

	processResource(resource)
}
