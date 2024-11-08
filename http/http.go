package http

import (
	"cosmic-dolphin/config"
	"cosmic-dolphin/knowledge"
	"cosmic-dolphin/llm/agents"
	"fmt"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/rs/cors"
)

func Run() {
	port := config.GetConfig(config.Port)
	if port == "" {
		port = "8080"
	}

	jwtSecret := config.GetConfig(config.JWTSecret)

	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3001"},
		AllowCredentials: true,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
	})

	router := mux.NewRouter()

	router.Handle("/insert-resource", AuthMiddleware(jwtSecret)(http.HandlerFunc(knowledge.HandleInsertResource))).Methods("POST")
	router.HandleFunc("/prompt", agents.HandlePrompt).Methods("POST")
	router.Handle("/notes", AuthMiddleware(jwtSecret)(http.HandlerFunc(knowledge.GetAllNotesHandler))).Methods("GET")
	router.Handle("/notes/{id}", AuthMiddleware(jwtSecret)(http.HandlerFunc(knowledge.GetNoteHandler))).Methods("GET")

	handler := c.Handler(router)

	fmt.Printf("Server running on port %s\n", port)
	err := http.ListenAndServe(":"+port, handler)
	if err != nil {
		fmt.Println("Error starting server:", err)
	}
}
