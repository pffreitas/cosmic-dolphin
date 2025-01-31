package notes

import (
	"cosmic-dolphin/pipeline"
	"encoding/json"
	"time"
)

type NoteType string

const (
	NoteTypeFUP       NoteType = "fup"
	NoteTypeChatter   NoteType = "chatter"
	NoteTypeKnowledge NoteType = "knowledge"
)

var validNoteTypes = map[NoteType]struct{}{
	NoteTypeFUP:       {},
	NoteTypeChatter:   {},
	NoteTypeKnowledge: {},
}

// Add IsValid method to use the map
func (t NoteType) IsValid() bool {
	_, exists := validNoteTypes[t]
	return exists
}

type NoteMetadataKey string

const (
	NoteMetadataSource NoteMetadataKey = "source"
)

type Note struct {
	ID         *int64                          `json:"id"`
	DocumentID *int64                          `json:"documentId"`
	Type       NoteType                        `json:"type"`
	Title      string                          `json:"title"`
	Summary    string                          `json:"summary"`
	Tags       []string                        `json:"tags"`
	RawBody    string                          `json:"-"`
	Sections   []NoteSection                   `json:"sections" sql:"type:jsonb"`
	Metadata   map[NoteMetadataKey]interface{} `json:"-" sql:"type:jsonb"`
	UserID     string                          `json:"userId"`
	CreatedAt  time.Time                       `json:"createdAt"`
	Steps      []CosmicJobStep                 `json:"-" sql:"type:jsonb"`
	Pipelines  []pipeline.Pipeline[any]        `json:"pipelines"`
}

func (n Note) GetBody() (string, error) {
	body, err := json.Marshal(n.Sections)
	if err != nil {
		return "", err

	}

	return string(body), nil
}

func (n Note) AddMetadata(key NoteMetadataKey, value interface{}) {
	n.Metadata[key] = value
}

func (n Note) GetMetadata(key NoteMetadataKey) interface{} {
	return n.Metadata[key]
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

type CosmicJob struct {
	Key   string          `json:"key"`
	Title string          `json:"title"`
	Steps []CosmicJobStep `json:"steps"`
}

type CosmicJobStepStatus string

const (
	CosmicJobStepStatusPending  CosmicJobStepStatus = "pending"
	CosmicJobStepStatusRunning  CosmicJobStepStatus = "running"
	CosmicJobStepStatusComplete CosmicJobStepStatus = "complete"
	CosmicJobStepStatusFailed   CosmicJobStepStatus = "failed"
)

type CosmicJobStep struct {
	Key       string              `json:"key"`
	CreatedAt string              `json:"created_at"`
	Status    CosmicJobStepStatus `json:"status"`
}
