package knowledge_test

import (
	"cosmic-dolphin/config"
	"cosmic-dolphin/db"
	"cosmic-dolphin/job"
	"cosmic-dolphin/knowledge"
	"cosmic-dolphin/notes"
	"fmt"
	"testing"
	"time"

	"github.com/avast/retry-go"
	"github.com/stretchr/testify/assert"
)

func TestAddDocument(t *testing.T) {
	config.LoadEnv("../.dev.env")
	db.Init()

	knowledge.Init()

	err := job.Run()
	if err != nil {
		t.Fatal(err)
	}

	t.Cleanup(func() {
		job.Stop()
		db.Close()
	})

	t.Run("Insert Resource", func(t *testing.T) {
		rawBody := "https://www.docker.com/blog/model-based-testing-testcontainers-jqwik/?ref=dailydev"
		createdNote, err := notes.CreateNote(rawBody, notes.NoteTypeKnowledge, "user-id")
		assert.NoError(t, err)

		err = retry.Do(func() error {
			updatedNote, err := notes.GetNoteByID(*createdNote.ID, createdNote.UserID)
			if err != nil {
				return err
			}

			if len(updatedNote.Title) == 0 {
				return fmt.Errorf("Note not updated")
			}

			return nil
		}, retry.Delay(5*time.Second), retry.Attempts(5))

		if err != nil {
			t.Fatal(err)
		}

		updatedNote, err := notes.GetNoteByID(*createdNote.ID, createdNote.UserID)
		assert.NoError(t, err)
		assert.NotEmpty(t, updatedNote.Title)
	})

}
