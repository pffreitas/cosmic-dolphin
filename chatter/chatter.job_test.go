package chatter_test

import (
	"cosmic-dolphin/chatter"
	"cosmic-dolphin/config"
	"cosmic-dolphin/cosmictesting"
	"cosmic-dolphin/db"
	"cosmic-dolphin/job"
	"cosmic-dolphin/notes"
	"testing"

	"github.com/riverqueue/river"
	"github.com/stretchr/testify/assert"
)

func TestChatterJobWork(t *testing.T) {
	config.LoadEnv("../.dev.env")
	db.Init()

	job.AddWorker(&chatter.ChatterJobWorker{})
	err := job.Run()
	if err != nil {
		t.Fatal(err)
	}

	t.Cleanup(func() {
		job.Stop()
		db.Close()
	})

	t.Run("Chatter Job Work", func(t *testing.T) {
		subscribeChan, subscribeCancel := job.RiverClient.Subscribe(river.EventKindJobCompleted)
		defer subscribeCancel()

		createdNote, err := notes.CreateNote("Test note", notes.NoteTypeChatter, "user-id")
		assert.NoError(t, err)

		cosmictesting.WaitForNJobs(subscribeChan, 1)

		updatedNote, err := notes.GetNoteByID(*createdNote.ID, createdNote.UserID)
		assert.NoError(t, err)

		assert.NotEmpty(t, updatedNote.Title)
		assert.Equal(t, len(updatedNote.Sections), 2)
	})
}
