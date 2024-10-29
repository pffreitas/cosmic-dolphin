package main

import (
	"fmt"
	"net/http"

	"cosmic-dolphin/config"
	"cosmic-dolphin/job"
	"cosmic-dolphin/knowledge"

	"github.com/rs/cors"
)

func main() {
	config.LoadEnv(".dev.env")

	job.AddWorker(&knowledge.KnowledgeJobWorker{})
	_, err := job.Run()
	if err != nil {
		fmt.Println(err)
	}
	defer job.Stop()

	port := config.GetConfig(config.Port)
	if port == "" {
		port = "8080"
	}

	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3001"},
		AllowCredentials: true,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
	})

	http.HandleFunc("/draft", draftHandler)
	http.HandleFunc("/getDocs", getDocsHandler)
	handler := c.Handler(http.DefaultServeMux)

	err = http.ListenAndServe(":"+port, handler)
	if err != nil {
		fmt.Println(err.Error())
	}

}
