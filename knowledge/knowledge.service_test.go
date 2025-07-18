package knowledge_test

import (
	"cosmic-dolphin/config"
	"cosmic-dolphin/db"
	"cosmic-dolphin/notes"
	"testing"
	"time"

	"github.com/avast/retry-go"
	"github.com/stretchr/testify/assert"
)

func TestCreateKnowledgeNote(t *testing.T) {
	config.LoadEnv("../.dev.env")
	db.Init()

	t.Cleanup(func() {
		db.Close()
	})

	t.Run("Create Knowledge Note", func(t *testing.T) {
		rawBody := "https://www.docker.com/blog/model-based-testing-testcontainers-jqwik/?ref=dailydev"
		createdNote, err := notes.CreateNote(rawBody, notes.NoteTypeKnowledge, "user-id")
		assert.NoError(t, err)

		err = retry.Do(func() error {
			updatedNote, err := notes.GetNoteByID(*createdNote.ID, createdNote.UserID)
			if err != nil {
				return err
			}

			assert.Equal(t, createdNote.RawBody, updatedNote.RawBody)

			return nil
		}, retry.Delay(5*time.Second), retry.Attempts(5))

		if err != nil {
			t.Fatal(err)
		}

		updatedNote, err := notes.GetNoteByID(*createdNote.ID, createdNote.UserID)
		assert.NoError(t, err)
		assert.Equal(t, notes.NoteTypeKnowledge, updatedNote.Type)
	})

}
