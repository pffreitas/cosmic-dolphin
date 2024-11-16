package notes_test

import (
	"bytes"
	"cosmic-dolphin/config"
	"cosmic-dolphin/db"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	jwt "github.com/golang-jwt/jwt/v5"
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
	})

}
