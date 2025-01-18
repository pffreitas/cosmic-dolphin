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

	query := `INSERT INTO resources (note_id, type, source, created_at, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING id`
	var id int64
	err := db.DBPool.QueryRow(
		context.Background(),
		query,
		resource.NoteID,
		resource.Type,
		resource.Source,
		resource.CreatedAt,
		resource.UserID).Scan(&id)

	if err != nil {
		log.WithFields(logrus.Fields{"error": err}).Error("Failed to insert resource")
		return nil, fmt.Errorf("failed to insert resource: %w", err)
	}

	resource.ID = &id

	log.WithField("resource.id", id).Info("Resource inserted")
	return &resource, nil
}

func fetchResourceByNoteID(noteID int64) (*Resource, error) {
	query := `
        SELECT id, note_id, type, source, created_at, user_id
        FROM resources
        WHERE note_id = $1
    `

	var resource Resource
	err := db.DBPool.QueryRow(context.Background(), query, noteID).Scan(
		&resource.ID,
		&resource.NoteID,
		&resource.Type,
		&resource.Source,
		&resource.CreatedAt,
		&resource.UserID,
	)
	if err != nil {
		log.WithFields(logrus.Fields{"noteID": noteID, "error": err}).Error("Failed to fetch resource by NoteID")
		return nil, fmt.Errorf("failed to fetch resource by NoteID: %w", err)
	}

	log.WithField("resource.id", resource.ID).Info("Resource fetched by NoteID")
	return &resource, nil
}

func fetchResourceByDocumentID(documentID int64) (*Resource, error) {
	query := `
		SELECT r.id, r.note_id, r.type, r.source, r.created_at, r.user_id
		FROM resources r
		JOIN documents d ON r.id = d.resource_id
		WHERE d.id = $1
	`

	var resource Resource
	err := db.DBPool.QueryRow(context.Background(), query, documentID).Scan(
		&resource.ID,
		&resource.NoteID,
		&resource.Type,
		&resource.Source,
		&resource.CreatedAt,
		&resource.UserID,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("resource for document with ID %d not found", documentID)
		}
		logrus.WithFields(logrus.Fields{"documentID": documentID, "error": err}).Error("Failed to fetch resource")
		return nil, fmt.Errorf("failed to fetch resource: %w", err)
	}

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
