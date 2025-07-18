package notes_test

import (
	"cosmic-dolphin/config"
	"cosmic-dolphin/cosmictesting"
	"cosmic-dolphin/db"
	"net/http/httptest"
	"testing"

	cdhttp "cosmic-dolphin/http"
)

func TestCreateNoteHandler(t *testing.T) {

	router := cdhttp.SetupRouter()
	testServer := httptest.NewServer(router)

	_, err := cosmictesting.NewCosmicAPIClient(testServer.URL)
	if err != nil {
		t.Fatal(err)
	}

	config.LoadEnv("../.dev.env")

	db.Init()

	t.Cleanup(func() {
		db.Close()
	})

	t.Run("Successful note creation", func(t *testing.T) {
		// // create note
		// noteCreated, response, err := apiClient.NotesAPI.
		// 	NotesCreate(context.Background()).
		// 	CreateNoteRequest(*cosmicdolphinapi.NewCreateNoteRequest("Foo Bar", cosmicdolphinapi.KNOWLEDGE)).
		// 	Execute()

		// assert.NoError(t, err)
		// assert.NotNil(t, noteCreated)
		// assert.Equal(t, http.StatusCreated, response.StatusCode)

		// // get note by id
		// var note *cosmicdolphinapi.Note
		// var findNoteResponse *http.Response
		// err = retry.Do(
		// 	func() error {
		// 		note, findNoteResponse, err = apiClient.NotesAPI.NotesFindById(context.Background(), fmt.Sprint(*noteCreated.Id)).Execute()
		// 		if err != nil {
		// 			return err
		// 		}

		// 		if findNoteResponse.StatusCode != http.StatusOK {
		// 			return fmt.Errorf("status code is not 200")
		// 		}

		// 		if note == nil {
		// 			return fmt.Errorf("note is nil")
		// 		}

		// 		return nil
		// 	},
		// 	retry.Delay(3*time.Second), retry.Attempts(3),
		// )
		// assert.NoError(t, err)

		// assert.NotNil(t, note)
		// assert.Equal(t, cosmicdolphinapi.KNOWLEDGE, note.Type)

		// // get all notes
		// notes, response, err := apiClient.NotesAPI.NotesFindAll(context.Background()).Execute()
		// assert.NoError(t, err)
		// assert.NotNil(t, notes)
		// assert.Equal(t, http.StatusOK, response.StatusCode)
		// assert.Greater(t, len(notes), 0)
	})

	t.Run("Successful note creation - Chat type", func(t *testing.T) {
		// noteCreated, response, err := apiClient.NotesAPI.
		// 	NotesCreate(context.Background()).
		// 	CreateNoteRequest(*cosmicdolphinapi.NewCreateNoteRequest("Hello Chat", cosmicdolphinapi.CHATTER)).
		// 	Execute()

		// assert.NoError(t, err)
		// assert.NotNil(t, noteCreated)
		// assert.Equal(t, http.StatusCreated, response.StatusCode)
		// assert.Equal(t, cosmicdolphinapi.CHATTER, noteCreated.Type)
	})

	t.Run("Invalid request - Empty body", func(t *testing.T) {
		// _, response, err := apiClient.NotesAPI.
		// 	NotesCreate(context.Background()).
		// 	CreateNoteRequest(*cosmicdolphinapi.NewCreateNoteRequest("", cosmicdolphinapi.KNOWLEDGE)).
		// 	Execute()

		// assert.Error(t, err)
		// assert.Equal(t, http.StatusBadRequest, response.StatusCode)
	})

	t.Run("Invalid request - Invalid note type", func(t *testing.T) {
		// req := cosmicdolphinapi.NewCreateNoteRequest("Test note", "INVALID_TYPE")
		// _, response, err := apiClient.NotesAPI.
		// 	NotesCreate(context.Background()).
		// 	CreateNoteRequest(*req).
		// 	Execute()

		// assert.Error(t, err)
		// assert.Equal(t, http.StatusBadRequest, response.StatusCode)
	})

}
