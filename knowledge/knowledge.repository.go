package knowledge

import (
	"context"
	"cosmic-dolphin/db"
	"encoding/json"
	"fmt"
	"time"

	"github.com/sirupsen/logrus"
)

func insertResource(resource Resource) (*Resource, error) {
	log.WithFields(logrus.Fields{"resource.source": resource.Source}).Info("Inserting resource")

	query := `INSERT INTO resources (type, source, created_at, user_id) VALUES ($1, $2, $3, $4) RETURNING id`
	var id int64
	err := db.DBPool.QueryRow(context.Background(), query, resource.Type, resource.Source, resource.CreatedAt, resource.UserID).Scan(&id)
	if err != nil {
		log.WithFields(logrus.Fields{"error": err}).Error("Failed to insert resource")
		return nil, fmt.Errorf("failed to insert resource: %w", err)
	}

	resource.ID = &id

	return &resource, nil
}

func insertDocument(document Document) (*Document, error) {
	log.WithFields(logrus.Fields{"document.title": document.Title}).Info("Inserting document")

	query := `
        INSERT INTO documents (resource_id, title, content, images, embeddings, user_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, created_at
    `
	var id int64
	var createdAt time.Time
	imagesJSON, err := json.Marshal(document.Images)
	if err != nil {
		log.WithFields(logrus.Fields{"error": err}).Error("Failed to marshal images")
		return nil, fmt.Errorf("failed to marshal images: %w", err)
	}

	err = db.DBPool.QueryRow(
		context.Background(),
		query,
		document.ResourceID,
		document.Title,
		document.Content,
		imagesJSON,
		document.Embeddings,
		document.UserID,
		document.CreatedAt,
	).Scan(&id, &createdAt)
	if err != nil {
		log.WithFields(logrus.Fields{"error": err}).Error("Failed to insert document")
		return nil, fmt.Errorf("failed to insert document: %w", err)
	}

	document.ID = &id
	document.CreatedAt = createdAt

	return &document, nil
}
