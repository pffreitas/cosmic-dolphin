package main

import (
	"cosmic-dolphin/config"
	"cosmic-dolphin/db"
	"cosmic-dolphin/http"
	"cosmic-dolphin/log"
)

func main() {
	config.LoadEnv(".dev.env")

	log.Init()

	db.Init()
	defer db.Close()

	http.Run()
}
