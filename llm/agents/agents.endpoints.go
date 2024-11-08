package agents

import (
	"encoding/json"
	"net/http"
)

func HandlePrompt(w http.ResponseWriter, r *http.Request) {
	var requestBody struct {
		Prompt string `json:"prompt"`
	}

	if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	Run()
}
