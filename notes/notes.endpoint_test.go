package notes_test

import (
	"context"
	"cosmic-dolphin/chatter"
	"cosmic-dolphin/config"
	"cosmic-dolphin/cosmictesting"
	"cosmic-dolphin/db"
	"cosmic-dolphin/job"
	"cosmic-dolphin/knowledge"
	"cosmic-dolphin/notes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	cdhttp "cosmic-dolphin/http"

	"github.com/avast/retry-go"
	cosmicdolphinapi "github.com/pffreitas/cosmic-dolphin-api-go"
)

func TestCreateNoteHandler(t *testing.T) {

	router := cdhttp.SetupRouter()
	testServer := httptest.NewServer(router)

	apiClient, err := cosmictesting.NewCosmicAPIClient(testServer.URL)
	if err != nil {
		t.Fatal(err)
	}

	config.LoadEnv("../.dev.env")

	chatter.Init()
	knowledge.Init()
	db.Init()

	job.AddWorker(&notes.ProcessNoteJobWorker{})
	err = job.Run()
	if err != nil {
		t.Fatal(err)
	}

	t.Cleanup(func() {
		db.Close()
		job.Stop()
	})

	t.Run("Successful note creation", func(t *testing.T) {
		// create note
		noteCreated, response, err := apiClient.NotesAPI.
			NotesCreate(context.Background()).
			CreateNoteRequest(*cosmicdolphinapi.NewCreateNoteRequest("Foo Bar", cosmicdolphinapi.KNOWLEDGE)).
			Execute()

		assert.NoError(t, err)
		assert.NotNil(t, noteCreated)
		assert.Equal(t, http.StatusCreated, response.StatusCode)

		// get note by id
		var note *cosmicdolphinapi.Note
		var findNoteResponse *http.Response
		err = retry.Do(
			func() error {
				note, findNoteResponse, err = apiClient.NotesAPI.NotesFindById(context.Background(), fmt.Sprint(*noteCreated.Id)).Execute()
				if err != nil {
					return err
				}

				if findNoteResponse.StatusCode != http.StatusOK {
					return fmt.Errorf("status code is not 200")
				}

				if note == nil {
					return fmt.Errorf("note is nil")
				}

				if note.Pipelines == nil {
					return fmt.Errorf("note pipelines is nil")
				}

				return nil
			},
			retry.Delay(3*time.Second), retry.Attempts(3),
		)
		assert.NoError(t, err)

		assert.NotNil(t, note)
		assert.Equal(t, cosmicdolphinapi.KNOWLEDGE, note.Type)
		assert.NotNil(t, note.Pipelines)
		assert.Greater(t, len(note.Pipelines), 0)
		assert.NotEmpty(t, note.Pipelines[0].Status)

		// get all notes
		notes, response, err := apiClient.NotesAPI.NotesFindAll(context.Background()).Execute()
		assert.NoError(t, err)
		assert.NotNil(t, notes)
		assert.Equal(t, http.StatusOK, response.StatusCode)
		assert.Greater(t, len(notes), 0)
		assert.Greater(t, len(notes[0].Pipelines), 0)
		assert.NotEmpty(t, notes[0].Pipelines[0].Status)
	})

	t.Run("Successful note creation - Chat type", func(t *testing.T) {
		noteCreated, response, err := apiClient.NotesAPI.
			NotesCreate(context.Background()).
			CreateNoteRequest(*cosmicdolphinapi.NewCreateNoteRequest("Hello Chat", cosmicdolphinapi.CHATTER)).
			Execute()

		assert.NoError(t, err)
		assert.NotNil(t, noteCreated)
		assert.Equal(t, http.StatusCreated, response.StatusCode)
		assert.Equal(t, cosmicdolphinapi.CHATTER, noteCreated.Type)
	})

	t.Run("Invalid request - Empty body", func(t *testing.T) {
		_, response, err := apiClient.NotesAPI.
			NotesCreate(context.Background()).
			CreateNoteRequest(*cosmicdolphinapi.NewCreateNoteRequest("", cosmicdolphinapi.KNOWLEDGE)).
			Execute()

		assert.Error(t, err)
		assert.Equal(t, http.StatusBadRequest, response.StatusCode)
	})

	t.Run("Invalid request - Invalid note type", func(t *testing.T) {
		req := cosmicdolphinapi.NewCreateNoteRequest("Test note", "INVALID_TYPE")
		_, response, err := apiClient.NotesAPI.
			NotesCreate(context.Background()).
			CreateNoteRequest(*req).
			Execute()

		assert.Error(t, err)
		assert.Equal(t, http.StatusBadRequest, response.StatusCode)
	})

	t.Run("Verify pipeline processing", func(t *testing.T) {
		noteCreated, _, err := apiClient.NotesAPI.
			NotesCreate(context.Background()).
			CreateNoteRequest(*cosmicdolphinapi.NewCreateNoteRequest("Process this note", cosmicdolphinapi.KNOWLEDGE)).
			Execute()

		assert.NoError(t, err)
		assert.NotNil(t, noteCreated)

		// Wait and verify pipeline processing
		var note *cosmicdolphinapi.Note
		err = retry.Do(
			func() error {
				note, _, err = apiClient.NotesAPI.
					NotesFindById(context.Background(), fmt.Sprint(*noteCreated.Id)).
					Execute()
				if err != nil {
					return err
				}

				if len(note.Pipelines) == 0 {
					return fmt.Errorf("pipeline not created yet")
				}

				if note.Pipelines[0].Status == "" {
					return fmt.Errorf("pipeline status not updated yet")
				}

				return nil
			},
			retry.Delay(2*time.Second),
			retry.Attempts(5),
		)

		assert.NoError(t, err)
		assert.NotNil(t, note.Pipelines)
		assert.Greater(t, len(note.Pipelines), 0)
		assert.NotEmpty(t, note.Pipelines[0].Status)
	})
}
