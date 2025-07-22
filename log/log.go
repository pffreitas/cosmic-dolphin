package log

import (
	"os"

	"github.com/sirupsen/logrus"
)

var Log *logrus.Logger

func Init() {
	Log = logrus.New()

	// Use pretty JSON formatter with truncation for development
	if os.Getenv("ENV") == "production" {
		// Use compact JSON for production
		Log.SetFormatter(&logrus.JSONFormatter{})
	} else {
		// Use pretty formatter with truncation for development
		Log.SetFormatter(NewColorizedJSONFormatter())
	}
}
