package notes

import (
	"context"
	"cosmic-dolphin/db"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/sirupsen/logrus"
)

func marshalSections(sections []NoteSection) ([]byte, error) {
	sectionsJSON, err := json.Marshal(sections)
	if err != nil {
		logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to marshal sections")
		return nil, fmt.Errorf("failed to marshal sections: %w", err)
	}
	return sectionsJSON, nil
}

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

func unmarshalSections(data []byte) ([]NoteSection, error) {
	var sections []NoteSection
	err := json.Unmarshal(data, &sections)
	if err != nil {
		logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to unmarshal sections")
		return nil, fmt.Errorf("failed to unmarshal sections: %w", err)
	}
	return sections, nil
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

	sectionsJSON, err := marshalSections(note.Sections)
	if err != nil {
		return nil, err
	}

	tagsJSON, err := marshalTags(note.Tags)
	if err != nil {
		return nil, err
	}

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

		sections, err := unmarshalSections(sectionsJSON)
		if err != nil {
			return nil, err
		}
		note.Sections = sections

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

	sections, err := unmarshalSections(sectionsJSON)
	if err != nil {
		return nil, err
	}
	note.Sections = sections

	tags, err := unmarshalTags(tagsJSON)
	if err != nil {
		return nil, err
	}
	note.Tags = tags

	return &note, nil
}

func UpdateNote(note Note) error {
	logrus.WithFields(logrus.Fields{"note.id": note.ID}).Info("Updating note")

	query := `
		UPDATE notes
		SET title = $1, body = $2, summary = $3, tags = $4, sections = $5
		WHERE id = $6
	`

	sectionsJSON, err := marshalSections(note.Sections)
	if err != nil {
		return err
	}

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
		sectionsJSON,
		note.ID,
	)
	if err != nil {
		logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to update note")
		return fmt.Errorf("failed to update note: %w", err)
	}

	return nil
}
