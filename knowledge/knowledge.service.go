package knowledge

import (
	"context"
	"cosmic-dolphin/job"
	"time"

	"github.com/sirupsen/logrus"
)

var log = logrus.New()

type ResourceType string

const (
	ResourceTypeWebPage ResourceType = "web_page"
)

type Resource struct {
	ID        *int64       `json:"id"`
	Type      ResourceType `json:"type"`
	Source    string       `json:"source"`
	CreatedAt time.Time    `json:"created_at"`
	UserID    string       `json:"user_id"`
}

func processResource(resource Resource) error {
	log.WithFields(logrus.Fields{"resource.source": resource.Source}).Info("Processing resource")

	persistedResource, err := insertResource(resource)
	if err != nil {
		return err
	}

	err = postGetContentJob(*persistedResource)
	if err != nil {
		return err
	}

	return nil
}

func postGetContentJob(resource Resource) error {
	jobArgs := GetResourceContentJobArgs{
		Resource: resource,
	}

	_, err := job.RiverClient.Insert(context.Background(), jobArgs, nil)
	if err != nil {
		return err
	}

	return nil
}

type Image struct {
	Src string `json:"src"`
	Alt string `json:"alt"`
}

type Document struct {
	ID         *int64    `json:"id"`
	ResourceID int64     `json:"resource_id"`
	Title      []string  `json:"title"`
	Content    string    `json:"content"`
	Images     []Image   `json:"images"`
	Embeddings []float64 `json:"embeddings"`
	UserID     string    `json:"user_id"`
	CreatedAt  time.Time `json:"created_at"`
}
