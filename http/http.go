package http

import (
	"cosmic-dolphin/config"
	"cosmic-dolphin/cosmicdolphin"
	"fmt"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/rs/cors"
)

func SetupRouter() *mux.Router {
	jwtSecret := config.GetConfig(config.JWTSecret)

	router := mux.NewRouter()

	router.Handle("/notes", AuthMiddleware(jwtSecret)(http.HandlerFunc(cosmicdolphin.GetAllNotesHandler))).Methods("GET")
	router.Handle("/notes", AuthMiddleware(jwtSecret)(http.HandlerFunc(cosmicdolphin.CreateNoteHandler))).Methods("POST")
	router.Handle("/notes/{id}", AuthMiddleware(jwtSecret)(http.HandlerFunc(cosmicdolphin.GetNoteHandler))).Methods("GET")

	router.Handle("/knowledge", AuthMiddleware(jwtSecret)(http.HandlerFunc(cosmicdolphin.AddToKnowledge))).Methods("GET")

	return router
}

func SetupHandler() http.Handler {
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000", "http://localhost:3001", "https://cosmic-dolphin.com/", "*"},
		AllowCredentials: true,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
	})

	router := SetupRouter()
	return c.Handler(router)
}

func Run() {
	port := config.GetConfig(config.Port)
	if port == "" {
		port = "8080"
	}

	handler := SetupHandler()

	fmt.Printf("Server running on port %s\n", port)
	err := http.ListenAndServe(":"+port, handler)
	if err != nil {
		fmt.Println("Error starting server:", err)
	}
}
