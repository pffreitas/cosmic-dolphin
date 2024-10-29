package knowledge

import (
	"cosmic-dolphin/db"

	"github.com/sirupsen/logrus"
)

var log = logrus.New()

type ResourceType string

const (
	ResourceTypeWebPage ResourceType = "web_page"
)

type Resource struct {
	ID     string       `json:"id"`
	Type   ResourceType `json:"type"`
	Source string       `json:"source"`
}

func insertResource(resource Resource) error {
	log.WithFields(logrus.Fields{"resource.id": resource.ID}).Info("Inserting resource")

	log.WithFields(logrus.Fields{"db pool": db.DBPool}).Info("Inserting resource")
	return nil
}
