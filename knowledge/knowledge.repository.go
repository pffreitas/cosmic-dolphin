package knowledge

import (
	"context"
	"cosmic-dolphin/db"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/pgvector/pgvector-go"
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

	log.WithField("resource.id", id).Info("Resource inserted")
	return &resource, nil
}

func insertDocument(document Document) (*Document, error) {
	log.WithFields(logrus.Fields{"document.title": document.Title}).Info("Inserting document")

	query := `
        INSERT INTO documents (resource_id, title, content, images, user_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
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

func fetchDocumentByID(id int64) (*Document, error) {
	query := `
        SELECT id, resource_id, title, content, images, user_id, created_at
        FROM documents
        WHERE id = $1
    `

	var document Document
	var imagesJSON []byte

	err := db.DBPool.QueryRow(context.Background(), query, id).Scan(
		&document.ID,
		&document.ResourceID,
		&document.Title,
		&document.Content,
		&imagesJSON,
		&document.UserID,
		&document.CreatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("document with ID %d not found", id)
		}
		logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to fetch document")
		return nil, fmt.Errorf("failed to fetch document: %w", err)
	}

	err = json.Unmarshal(imagesJSON, &document.Images)
	if err != nil {
		logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to unmarshal images")
		return nil, fmt.Errorf("failed to unmarshal images: %w", err)
	}

	return &document, nil
}

func insertEmbedding(embedding Embedding) (*Embedding, error) {
	query := `
        INSERT INTO embeddings (document_id, embeddings)
        VALUES ($1, $2)
        RETURNING id
    `

	var id int64
	err := db.DBPool.QueryRow(context.Background(), query, embedding.DocumentID, pgvector.NewVector(embedding.Embedding)).Scan(&id)
	if err != nil {
		logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to insert embedding")
		return nil, fmt.Errorf("failed to insert embedding: %w", err)
	}

	embedding.ID = id
	return &embedding, nil
}
