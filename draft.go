package main

import (
	"context"
	"cosmic-dolphin/job"
	"cosmic-dolphin/knowledge"
	"cosmic-dolphin/model"
	"cosmic-dolphin/service"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/riverqueue/river"
)

type EmbeddingsResponse struct {
	Message    string
	Embeddings []float64
}

func draftHandler(w http.ResponseWriter, r *http.Request) {
	var requestBody struct {
		Text string `json:"text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	embeddingsResponse, err := service.GenerateEmbeddings(service.GenerateEmbeddingsRequest{
		Content: requestBody.Text,
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	for _, embedding := range embeddingsResponse {
		service.StoreDocument(model.Document{
			Body:       requestBody.Text,
			Embeddings: embedding.Embeddings,
		})
	}

	fmt.Println("Inserting job", job.RiverClient)
	_, err = job.RiverClient.Insert(context.Background(), knowledge.KnowledgeJobArgs{
		Strings: []string{"whale", "tiger", "bear"},
	}, &river.InsertOpts{
		MaxAttempts: 3,
	})

	if err != nil {
		fmt.Println("err >>>>>>>", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(embeddingsResponse)
}

func getDocsHandler(w http.ResponseWriter, r *http.Request) {
	var requestBody struct {
		Text string `json:"text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	docs, err := retrieveDocs(requestBody.Text)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(docs)
}

func retrieveDocs(prompt string) (docs []model.Document, err error) {
	fmt.Println("Retrieving docs for prompt:", prompt)
	promptEmbeddings, err := service.GenerateEmbeddings(service.GenerateEmbeddingsRequest{
		Content: prompt,
	})
	if err != nil {
		return nil, err
	}

	docs, err = service.SelectDocuments(promptEmbeddings[0].Embeddings)
	if err != nil {
		return nil, err
	}

	return docs, nil
}
