package notes

import (
	"encoding/json"
	"time"
)

type NoteType string

const (
	NoteTypeFUP       NoteType = "fup"
	NoteTypeChatter   NoteType = "chatter"
	NoteTypeKnowledge NoteType = "knowledge"
)

type Note struct {
	ID         *int64        `json:"id"`
	DocumentID *int64        `json:"document_id"`
	Type       NoteType      `json:"type"`
	Title      string        `json:"title"`
	Summary    string        `json:"summary"`
	Tags       string        `json:"tags"`
	Sections   []NoteSection `json:"sections" sql:"type:jsonb"`
	UserID     string        `json:"user_id"`
	CreatedAt  time.Time     `json:"created_at"`
}

func (n Note) GetBody() (string, error) {
	body, err := json.Marshal(n.Sections)
	if err != nil {
		return "", err

	}

	return string(body), nil
}

type NoteSectionType string

const (
	NoteSectionTypeText NoteSectionType = "text"
)

type NoteSection struct {
	Type    NoteSectionType        `json:"type"`
	Content map[string]interface{} `json:"content"`
}

type TextSectionContentAttributes string

const (
	TextSectionTitle TextSectionContentAttributes = "title"
	TextSectionBody  TextSectionContentAttributes = "text"
)

func NewTextSection(title, body string) NoteSection {
	return NoteSection{
		Type: NoteSectionTypeText,
		Content: map[string]interface{}{
			string(TextSectionTitle): title,
			string(TextSectionBody):  body,
		},
	}
}
