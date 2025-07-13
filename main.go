package main

import (
	"cosmic-dolphin/chatter"
	"cosmic-dolphin/config"
	"cosmic-dolphin/db"
	"cosmic-dolphin/http"
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

	// job.AddWorker(&notes.ProcessNoteJobWorker{})

	// err := job.Run()
	// if err != nil {
	// 	panic(err)
	// }
	// defer job.Stop()

	http.Run()
}
