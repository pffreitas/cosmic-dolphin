package main

import (
	"cosmic-dolphin/config"
	"cosmic-dolphin/db"
	"cosmic-dolphin/http"
	"cosmic-dolphin/job"
	"cosmic-dolphin/knowledge"
	"cosmic-dolphin/log"
)

func main() {
	config.LoadEnv(".dev.env")

	log.Init()

	db.Init()
	defer db.Close()

	job.AddWorker(&knowledge.InsertResourceJobWorker{})
	err := job.Run()
	if err != nil {
		panic(err)
	}
	defer job.Stop()

	http.Run()
}
