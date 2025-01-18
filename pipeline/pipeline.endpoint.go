package pipeline

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"
)

func FindPipelinesByRefId(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)

	refId, err := strconv.ParseInt(vars["refId"], 10, 64)
	if err != nil {
		logrus.WithError(err).Error("Invalid refId")
		http.Error(w, "Invalid refId", http.StatusBadRequest)
		return
	}

	pipes, err := GetPipelinesByReferenceID[any](refId)
	if err != nil {
		logrus.WithError(err).Error("Failed to find pipeline by refId")
		http.Error(w, "Invalid refId", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(pipes); err != nil {
		logrus.WithError(err).Error("Failed to encode notes")
		http.Error(w, "Failed to encode notes", http.StatusInternalServerError)
	}
}
