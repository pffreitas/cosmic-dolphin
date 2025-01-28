package notes

import (
	"context"
	"cosmic-dolphin/db"
	"cosmic-dolphin/pipeline"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/sirupsen/logrus"
)

func InsertNote(note Note) (*Note, error) {
	logrus.WithFields(logrus.Fields{"note.title": note.Title, "documentId": note.RawBody}).Info("Inserting note")

	query := `
        INSERT INTO notes (document_id, title, raw_body, summary, tags, sections, note_type, user_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, created_at
    `

	sectionsJSON, err := json.Marshal(note.Sections)
	if err != nil {
		logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to marshal sections")
		return nil, fmt.Errorf("failed to marshal sections: %w", err)
	}

	var id int64
	var createdAt time.Time
	err = db.DBPool.QueryRow(
		context.Background(),
		query,
		note.DocumentID,
		note.Title,
		note.RawBody,
		note.Summary,
		note.Tags,
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
		SELECT id, document_id, title, raw_body, summary, tags, sections, note_type, user_id
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

		err := rows.Scan(
			&note.ID,
			&note.DocumentID,
			&note.Title,
			&note.RawBody,
			&note.Summary,
			&note.Tags,
			&sectionsJSON,
			&note.Type,
			&note.UserID,
		)
		if err != nil {
			logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to scan note")
			return nil, fmt.Errorf("failed to scan note: %w", err)
		}

		err = json.Unmarshal(sectionsJSON, &note.Sections)
		if err != nil {
			logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to unmarshal sections")
			return nil, fmt.Errorf("failed to unmarshal sections: %w", err)
		}

		pipelines, err := pipeline.GetPipelinesByReferenceID[any](*note.ID)
		if err != nil {
			logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to fetch pipelines for note; returning note without pipelines")
		}
		logrus.WithFields(logrus.Fields{"pipelines": pipelines}).Info("Pipelines")
		note.Pipelines = pipelines

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
		SELECT id, document_id, title, raw_body, summary, tags, sections, note_type, user_id, created_at
		FROM notes
		WHERE id = $1 and user_id = $2
	`

	var note Note
	var sectionsJSON []byte

	err := db.DBPool.QueryRow(context.Background(), query, id, userID).Scan(
		&note.ID,
		&note.DocumentID,
		&note.Title,
		&note.RawBody,
		&note.Summary,
		&note.Tags,
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

	err = json.Unmarshal(sectionsJSON, &note.Sections)
	if err != nil {
		logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to unmarshal sections")
		return nil, fmt.Errorf("failed to unmarshal sections: %w", err)
	}

	pipelines, err := pipeline.GetPipelinesByReferenceID[any](*note.ID)
	if err != nil {
		logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to fetch pipelines for note; returning note without pipelines")
		return &note, nil
	}
	note.Pipelines = pipelines

	return &note, nil
}

func UpdateNote(note Note) error {
	logrus.WithFields(logrus.Fields{"note.id": note.ID}).Info("Updating note")

	query := `
		UPDATE notes
		SET title = $1, summary = $2, tags = $3, sections = $4
		WHERE id = $5
	`

	sectionsJSON, err := json.Marshal(note.Sections)
	if err != nil {
		logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to marshal sections")
		return fmt.Errorf("failed to marshal sections: %w", err)
	}

	_, err = db.DBPool.Exec(
		context.Background(),
		query,
		note.Title,
		note.Summary,
		note.Tags,
		sectionsJSON,
		note.ID,
	)
	if err != nil {
		logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to update note")
		return fmt.Errorf("failed to update note: %w", err)
	}

	return nil
}
