package knowledge

import "time"

type ResourceType string

const (
	ResourceTypeWebPage ResourceType = "web_page"
)

type Resource struct {
	ID        *int64       `json:"id"`
	NoteID    int64        `json:"note_id"`
	Type      ResourceType `json:"type"`
	Source    string       `json:"source"`
	CreatedAt time.Time    `json:"created_at"`
	UserID    string       `json:"user_id"`
}

type Document struct {
	ID         *int64    `json:"id"`
	ResourceID int64     `json:"resource_id"`
	Title      []string  `json:"title"`
	Content    string    `json:"content"`
	Images     []Image   `json:"images"`
	UserID     string    `json:"user_id"`
	CreatedAt  time.Time `json:"created_at"`
}

type Image struct {
	Src string `json:"src"`
	Alt string `json:"alt"`
}

type Embedding struct {
	ID         int64     `json:"id"`
	DocumentID int64     `json:"document_id"`
	Embedding  []float32 `json:"embedding"`
}
