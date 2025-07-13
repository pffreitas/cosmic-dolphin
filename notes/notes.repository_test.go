package notes_test

import (
	"cosmic-dolphin/config"
	"cosmic-dolphin/db"
	"cosmic-dolphin/notes"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNotesRepository(t *testing.T) {
	config.LoadEnv("../.dev.env")
	db.Init()
	defer db.Close()

	t.Run("Successfully insert note", func(t *testing.T) {
		note := notes.Note{
			Title:   "Test Note",
			Body:    "Test note body content",
			Summary: "This is a test note",
			Tags:    []string{"test"},
			Type:    notes.NoteTypeFUP,
			UserID:  "test-user-id",
		}

		insertedNote, err := notes.InsertNote(note)
		if err != nil {
			t.Fatalf("Failed to insert test note: %v", err)
		}

		if insertedNote == nil || insertedNote.ID == nil {
			t.Fatalf("Inserted note or note ID is nil")
		}

		fetchedNote, err := notes.GetNoteByID(*insertedNote.ID, insertedNote.UserID)
		assert.NoError(t, err, "GetNoteByID should not return an error")
		assert.Equal(t, notes.NoteTypeFUP, fetchedNote.Type, "Fetched note should have the correct type")
		assert.Equal(t, "Test note body content", fetchedNote.Body, "Fetched note should have the correct body")
	})

	t.Run("Successfully fetch note by ID", func(t *testing.T) {
		note := notes.Note{
			Title:   "Test Note Fetch",
			Summary: "This is a test note for fetching",
			Tags:    []string{"fetch"},
			Type:    notes.NoteTypeFUP,
			UserID:  "test-user-id-fetch",
		}

		insertedNote, err := notes.InsertNote(note)
		if err != nil {
			t.Fatalf("Failed to insert test note: %v", err)
		}

		if insertedNote == nil || insertedNote.ID == nil {
			t.Fatalf("Inserted note or note ID is nil")
		}

		fetchedNote, err := notes.GetNoteByID(*insertedNote.ID, insertedNote.UserID)
		assert.NoError(t, err, "GetNoteByID should not return an error")
		assert.Equal(t, note.Title, fetchedNote.Title, "Fetched note should have the correct title")
	})

	t.Run("Successfully fetch all notes", func(t *testing.T) {
		userID := "test-user-id-fetch-all"
		note1 := notes.Note{
			Title:   "Test Note 1",
			Summary: "This is the first test note",
			Tags:    []string{"fetch-all"},
			Type:    notes.NoteTypeFUP,
			UserID:  userID,
		}
		note2 := notes.Note{
			Title:   "Test Note 2",
			Summary: "This is the second test note",
			Tags:    []string{"fetch-all"},
			Type:    notes.NoteTypeFUP,
			UserID:  userID,
		}

		_, err := notes.InsertNote(note1)
		if err != nil {
			t.Fatalf("Failed to insert first test note: %v", err)
		}
		_, err = notes.InsertNote(note2)
		if err != nil {
			t.Fatalf("Failed to insert second test note: %v", err)
		}

		fetchedNotes, err := notes.FetchAllNotes(userID)
		assert.NoError(t, err, "GetNotesByUserID should not return an error")
		assert.GreaterOrEqual(t, len(fetchedNotes), 2, "Should fetch at least two notes")
	})

	t.Run("Successfully update note", func(t *testing.T) {
		note := notes.Note{
			Title:   "Test Note Update",
			Summary: "This is a test note for updating",
			Tags:    []string{"update"},
			Type:    notes.NoteTypeFUP,
			UserID:  "test-user-id-update",
		}

		insertedNote, err := notes.InsertNote(note)
		if err != nil {
			t.Fatalf("Failed to insert test note: %v", err)
		}

		insertedNote.Title = "Updated Test Note"
		insertedNote.Summary = "This is an updated test note"
		insertedNote.Body = "Updated test body content"

		err = notes.UpdateNote(*insertedNote)
		assert.NoError(t, err, "UpdateNote should not return an error")

		updatedNote, err := notes.GetNoteByID(*insertedNote.ID, insertedNote.UserID)
		assert.NoError(t, err, "GetNoteByID should not return an error")
		assert.Equal(t, "Updated Test Note", updatedNote.Title, "Updated note should have the correct title")
		assert.Equal(t, "This is an updated test note", updatedNote.Summary, "Updated note should have the correct summary")
		assert.Equal(t, "Updated test body content", updatedNote.Body, "Updated note should have the correct body")
	})
}
