package http

import (
	"cosmic-dolphin/config"
	"cosmic-dolphin/knowledge"
	"fmt"
	"net/http"

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

	http.Handle("/insert-resource", AuthMiddleware(jwtSecret)(http.HandlerFunc(knowledge.HandleInsertResource)))

	handler := c.Handler(http.DefaultServeMux)

	err := http.ListenAndServe(":"+port, handler)
	if err != nil {
		fmt.Println(err.Error())
	}
}
