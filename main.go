package main

import (
	"cosmic-dolphin/chatter"
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

	chatter.Init()
	knowledge.Init()

	job.AddWorker(&knowledge.GetResourceContentJobWorker{})
	job.AddWorker(&knowledge.EmbedDocumentJobWorker{})
	job.AddWorker(&knowledge.SummarizeJobWorker{})
	job.AddWorker(&chatter.ChatterJobWorker{})

	err := job.Run()
	if err != nil {
		panic(err)
	}
	defer job.Stop()

	http.Run()
}
