package cosmicdolphin

import (
	"context"
	"cosmic-dolphin/db"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/pgvector/pgvector-go"
	"github.com/sirupsen/logrus"
)

// Resource repository functions (from knowledge package)

func insertResource(resource Resource) (*Resource, error) {
	logrus.WithFields(logrus.Fields{"resource.source": resource.Source}).Info("Inserting resource")

	// Marshal JSON fields
	openGraphJSON, err := json.Marshal(resource.OpenGraph)
	if err != nil {
		logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to marshal OpenGraph")
		return nil, fmt.Errorf("failed to marshal OpenGraph: %w", err)
	}

	metadataJSON, err := json.Marshal(resource.Metadata)
	if err != nil {
		logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to marshal Metadata")
		return nil, fmt.Errorf("failed to marshal Metadata: %w", err)
	}

	userMetaJSON, err := json.Marshal(resource.UserMeta)
	if err != nil {
		logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to marshal UserMeta")
		return nil, fmt.Errorf("failed to marshal UserMeta: %w", err)
	}

	query := `INSERT INTO resources (note_id, type, source, opengraph, metadata, usermeta, created_at, user_id) 
			  VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`
	var id int64
	err = db.DBPool.QueryRow(
		context.Background(),
		query,
		resource.NoteID,
		resource.Type,
		resource.Source,
		openGraphJSON,
		metadataJSON,
		userMetaJSON,
		resource.CreatedAt,
		resource.UserID).Scan(&id)

	if err != nil {
		logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to insert resource")
		return nil, fmt.Errorf("failed to insert resource: %w", err)
	}

	resource.ID = &id

	logrus.WithField("resource.id", id).Info("Resource inserted")
	return &resource, nil
}

func GetResourcesByNoteID(noteID int64) ([]Resource, error) {
	query := `
        SELECT id, note_id, type, source, opengraph, metadata, usermeta, created_at, user_id
        FROM resources
        WHERE note_id = $1
    `

	rows, err := db.DBPool.Query(context.Background(), query, noteID)
	if err != nil {
		logrus.WithFields(logrus.Fields{"noteID": noteID, "error": err}).Error("Failed to fetch resources by NoteID")
		return nil, fmt.Errorf("failed to fetch resources by NoteID: %w", err)
	}
	defer rows.Close()

	var resources []Resource = []Resource{}
	for rows.Next() {
		var resource Resource
		var openGraphJSON, metadataJSON, userMetaJSON []byte

		err := rows.Scan(
			&resource.ID,
			&resource.NoteID,
			&resource.Type,
			&resource.Source,
			&openGraphJSON,
			&metadataJSON,
			&userMetaJSON,
			&resource.CreatedAt,
			&resource.UserID,
		)
		if err != nil {
			logrus.WithFields(logrus.Fields{"noteID": noteID, "error": err}).Error("Failed to scan resource")
			return nil, fmt.Errorf("failed to scan resource: %w", err)
		}

		// Unmarshal JSON fields
		if err := json.Unmarshal(openGraphJSON, &resource.OpenGraph); err != nil {
			logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to unmarshal OpenGraph")
			return nil, fmt.Errorf("failed to unmarshal OpenGraph: %w", err)
		}

		if err := json.Unmarshal(metadataJSON, &resource.Metadata); err != nil {
			logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to unmarshal Metadata")
			return nil, fmt.Errorf("failed to unmarshal Metadata: %w", err)
		}

		if err := json.Unmarshal(userMetaJSON, &resource.UserMeta); err != nil {
			logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to unmarshal UserMeta")
			return nil, fmt.Errorf("failed to unmarshal UserMeta: %w", err)
		}

		resources = append(resources, resource)
	}

	if err = rows.Err(); err != nil {
		logrus.WithFields(logrus.Fields{"noteID": noteID, "error": err}).Error("Rows iteration error")
		return nil, fmt.Errorf("rows iteration error: %w", err)
	}

	logrus.WithField("noteID", noteID).Infof("Fetched %d resources by NoteID", len(resources))
	return resources, nil
}

func insertDocument(document Document) (*Document, error) {
	logrus.WithFields(logrus.Fields{"document.title": document.Title}).Info("Inserting document")

	query := `
        INSERT INTO documents (resource_id, title, content, images, user_id, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, created_at
    `
	var id int64
	var createdAt time.Time
	imagesJSON, err := json.Marshal(document.Images)
	if err != nil {
		logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to marshal images")
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
		logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to insert document")
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

// Note repository functions (from notes package)

func marshalTags(tags []string) ([]byte, error) {
	if tags == nil {
		tags = []string{}
	}

	tagsJSON, err := json.Marshal(tags)
	if err != nil {
		logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to marshal tags")
		return nil, fmt.Errorf("failed to marshal tags: %w", err)
	}
	return tagsJSON, nil
}

func unmarshalTags(data []byte) ([]string, error) {
	if len(data) == 0 {
		return []string{}, nil
	}

	var tags []string
	err := json.Unmarshal(data, &tags)
	if err != nil {
		logrus.WithFields(logrus.Fields{"error": err, "tags": fmt.Sprintf("%s", data)}).Error("Failed to unmarshal tags")
		return nil, fmt.Errorf("failed to unmarshal tags: %w", err)
	}
	return tags, nil
}

func InsertNote(note Note) (*Note, error) {
	logrus.WithFields(logrus.Fields{"note.title": note.Title, "documentId": note.RawBody}).Info("Inserting note")

	query := `
        INSERT INTO notes (document_id, title, raw_body, body, summary, tags, sections, note_type, user_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, created_at
    `

	tagsJSON, err := marshalTags(note.Tags)
	if err != nil {
		return nil, err
	}

	// Handle sections as empty JSON array if not provided
	sectionsJSON := []byte("[]")

	var id int64
	var createdAt time.Time
	err = db.DBPool.QueryRow(
		context.Background(),
		query,
		note.DocumentID,
		note.Title,
		note.RawBody,
		note.Body,
		note.Summary,
		tagsJSON,
		sectionsJSON,
		note.Type,
		note.UserID,
	).Scan(&id, &createdAt)
	if err != nil {
		logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to insert note")
		return nil, fmt.Errorf("failed to insert note: %w", err)
	}

	note.ID = &id
	note.CreatedAt = createdAt

	return &note, nil
}

func FetchAllNotes(userID string) ([]Note, error) {
	logrus.Info("Fetching all notes")

	query := `
		SELECT id, document_id, title, raw_body, body, summary, tags, sections, note_type, user_id
		FROM notes
		WHERE user_id = $1
		order by created_at desc
		LIMIT 20
	`

	rows, err := db.DBPool.Query(context.Background(), query, userID)
	if err != nil {
		logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to fetch notes")
		return nil, fmt.Errorf("failed to fetch notes: %w", err)
	}
	defer rows.Close()

	var notes []Note
	for rows.Next() {
		var note Note
		var sectionsJSON []byte
		var tagsJSON []byte

		err := rows.Scan(
			&note.ID,
			&note.DocumentID,
			&note.Title,
			&note.RawBody,
			&note.Body,
			&note.Summary,
			&tagsJSON,
			&sectionsJSON,
			&note.Type,
			&note.UserID,
		)
		if err != nil {
			logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to scan note")
			return nil, fmt.Errorf("failed to scan note: %w", err)
		}

		tags, err := unmarshalTags(tagsJSON)
		if err != nil {
			return nil, err
		}
		note.Tags = tags

		notes = append(notes, note)
	}

	if err = rows.Err(); err != nil {
		logrus.WithFields(logrus.Fields{"error": err}).Error("Rows iteration error")
		return nil, fmt.Errorf("rows iteration error: %w", err)
	}

	return notes, nil
}

func GetNoteByID(id int64, userID string) (*Note, error) {
	logrus.WithFields(logrus.Fields{"note.id": id}).Info("Fetching note by ID")

	query := `
		SELECT id, document_id, title, raw_body, body, summary, tags, sections, note_type, user_id, created_at
		FROM notes
		WHERE id = $1 and user_id = $2
	`

	var note Note
	var sectionsJSON []byte
	var tagsJSON []byte

	err := db.DBPool.QueryRow(context.Background(), query, id, userID).Scan(
		&note.ID,
		&note.DocumentID,
		&note.Title,
		&note.RawBody,
		&note.Body,
		&note.Summary,
		&tagsJSON,
		&sectionsJSON,
		&note.Type,
		&note.UserID,
		&note.CreatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			logrus.WithFields(logrus.Fields{"note.id": id}).Warn("Note not found")
			return nil, nil
		}
		logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to fetch note by ID")
		return nil, fmt.Errorf("failed to fetch note by ID: %w", err)
	}

	tags, err := unmarshalTags(tagsJSON)
	if err != nil {
		return nil, err
	}
	note.Tags = tags

	return &note, nil
}

func UpdateNote(note Note) error {
	logrus.WithFields(logrus.Fields{"note.id": *note.ID}).Info("Updating note")

	query := `
		UPDATE notes
		SET title = $1, body = $2, summary = $3, tags = $4
		WHERE id = $5
	`

	tagsJSON, err := marshalTags(note.Tags)
	if err != nil {
		return err
	}

	_, err = db.DBPool.Exec(
		context.Background(),
		query,
		note.Title,
		note.Body,
		note.Summary,
		tagsJSON,
		note.ID,
	)
	if err != nil {
		logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to update note")
		return fmt.Errorf("failed to update note: %w", err)
	}

	return nil
}
