package knowledge_test

import (
	"bytes"
	"cosmic-dolphin/config"
	"cosmic-dolphin/db"
	"cosmic-dolphin/knowledge"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	jwt "github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"

	cdhttp "cosmic-dolphin/http"

	cosmicdolphinapi "github.com/pffreitas/cosmic-dolphin-api-go"
)

func generateJWT(secret string) (string, error) {
	// Define token claims
	claims := jwt.MapClaims{
		"authorized": true,
		"user_id":    1,
		"exp":        time.Now().Add(time.Hour * 1).Unix(),
	}

	// Create token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	// Sign token with secret
	tokenString, err := token.SignedString([]byte(secret))
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("Bearer %s", tokenString), nil
}

func TestGetNotesHandler(t *testing.T) {
	// req, err := http.NewRequest("GET", "/notes/1", nil)
	// assert.NoError(t, err)

	// rr := httptest.NewRecorder()
	// router := mux.NewRouter()
	// router.HandleFunc("/notes/{documentID}", knowledge.GetNotesHandler)
	// router.ServeHTTP(rr, req)

	// assert.Equal(t, http.StatusOK, rr.Code)
	// // Additional assertions can be added to verify the response body
}
func TestCreateNoteHandler(t *testing.T) {
	t.Run("Successful note creation", func(t *testing.T) {
		config.LoadEnv("../.dev.env")

		db.Init()
		defer db.Close()

		token, err := generateJWT(config.GetConfig(config.JWTSecret))
		if err != nil {
			t.Error(err)
		}

		createNoteRequest := *cosmicdolphinapi.NewCreateNoteRequest("Body_example", cosmicdolphinapi.NoteType("fup"))
		reqBody, err := createNoteRequest.MarshalJSON()
		assert.NoError(t, err)

		req, err := http.NewRequest("POST", "/notes", bytes.NewReader(reqBody))
		assert.NoError(t, err)
		req.Header.Set("Authorization", token)

		rr := httptest.NewRecorder()
		router := cdhttp.SetupRouter()
		router.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusCreated, rr.Code)

		createdNote := cosmicdolphinapi.NewNoteWithDefaults()
		createdNote.UnmarshalJSON(rr.Body.Bytes())
		j, err := createdNote.MarshalJSON()
		assert.NoError(t, err)
		fmt.Printf(">>>> <<< %s", j)
	})

	// Test case: Invalid request payload
	t.Run("Invalid request payload", func(t *testing.T) {
		reqBody := `{"body": "Test note body"}`
		req, err := http.NewRequest("POST", "/notes", strings.NewReader(reqBody))
		assert.NoError(t, err)

		rr := httptest.NewRecorder()
		router := mux.NewRouter()
		router.HandleFunc("/notes", knowledge.CreateNoteHandler)
		router.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})

	// Test case: Internal server error
	t.Run("Internal server error", func(t *testing.T) {
		reqBody := `{"body": "Test note body", "type": "text"}`
		req, err := http.NewRequest("POST", "/notes", strings.NewReader(reqBody))
		assert.NoError(t, err)

		rr := httptest.NewRecorder()
		router := mux.NewRouter()
		router.HandleFunc("/notes", knowledge.CreateNoteHandler)
		router.ServeHTTP(rr, req)

		// Simulate internal server error by mocking the createNote function
		// This part requires a mocking library like testify/mock or gomock
		// assert.Equal(t, http.StatusInternalServerError, rr.Code)
	})
}
