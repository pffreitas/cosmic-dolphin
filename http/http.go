package http

import (
	"cosmic-dolphin/config"
	"fmt"
	"net/http"

	"github.com/rs/cors"
)

func Run() {
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

	err := http.ListenAndServe(":"+port, handler)
	if err != nil {
		fmt.Println(err.Error())
	}
}
