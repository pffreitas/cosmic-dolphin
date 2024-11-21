package chatter_test

import (
	"cosmic-dolphin/chatter"
	"cosmic-dolphin/config"
	"cosmic-dolphin/db"
	"cosmic-dolphin/job"
	"cosmic-dolphin/notes"
	"fmt"
	"testing"
	"time"

	"github.com/avast/retry-go"
	"github.com/stretchr/testify/assert"
)

func TestChatterJobWork(t *testing.T) {
	config.LoadEnv("../.dev.env")
	db.Init()

	job.AddWorker(&chatter.ChatterJobWorker{})
	chatter.Init()
	err := job.Run()
	if err != nil {
		t.Fatal(err)
	}

	t.Cleanup(func() {
		job.Stop()
		db.Close()
	})

	t.Run("Chatter Job Work", func(t *testing.T) {

		createdNote, err := notes.CreateNote("Test note", notes.NoteTypeChatter, "user-id")
		assert.NoError(t, err)

		err = retry.Do(func() error {
			updatedNote, err := notes.GetNoteByID(*createdNote.ID, createdNote.UserID)
			if len(updatedNote.Title) == 0 || err != nil {
				return fmt.Errorf("Note not updated")
			}
			return nil
		}, retry.Delay(5*time.Second), retry.Attempts(5))
		assert.NoError(t, err)

		updatedNote, err := notes.GetNoteByID(*createdNote.ID, createdNote.UserID)
		assert.NoError(t, err)
		assert.NotEmpty(t, updatedNote.Title)
		assert.Equal(t, len(updatedNote.Sections), 1)

	})
}
