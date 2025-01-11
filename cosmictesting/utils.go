package cosmictesting

import (
	"cosmic-dolphin/config"
	"fmt"
	"time"

	jwt "github.com/golang-jwt/jwt/v5"

	"github.com/riverqueue/river"
)

func WaitForNJobs(subscribeChan <-chan *river.Event, numJobs int) {
	var (
		timeout  = time.Duration(5 * time.Minute)
		deadline = time.Now().Add(timeout)
		events   = make([]*river.Event, 0, numJobs)
	)

	for {
		select {
		case event := <-subscribeChan:
			events = append(events, event)

			if len(events) >= numJobs {
				return
			}

		case <-time.After(time.Until(deadline)):
			panic(fmt.Sprintf("WaitOrTimeout timed out after waiting %s (received %d job(s), wanted %d)",
				timeout, len(events), numJobs))
		}
	}
}

func GenerateJWT() (string, error) {
	secret := config.GetConfig(config.JWTSecret)

	claims := jwt.MapClaims{
		"authorized": true,
		"user_id":    1,
		"sub":        "test-user-id",
		"email":      "test-user-id@mail.com",
		"exp":        time.Now().Add(time.Hour * 1).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	tokenString, err := token.SignedString([]byte(secret))
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("Bearer %s", tokenString), nil
}
