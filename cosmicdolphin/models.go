package cosmicdolphin

import "time"

// Resource models (from knowledge package)
type ResourceType string

const (
	ResourceTypeWebPage ResourceType = "web_page"
	ResourceTypeImage   ResourceType = "image"
)

type ResourceMetadataKey string

const (
	ResourceMetadataTitle       ResourceMetadataKey = "title"
	ResourceMetadataDescription ResourceMetadataKey = "description"
	ResourceMetadataAuthor      ResourceMetadataKey = "author"
	ResourceMetadataURL         ResourceMetadataKey = "url"
	ResourceMetadataMetaTags    ResourceMetadataKey = "meta_tags"
)

// OpenGraph represents OpenGraph meta tags for social media sharing
type OpenGraph struct {
	// Required OpenGraph properties
	Title string `json:"title"` // og:title
	Type  string `json:"type"`  // og:type (article, website, etc.)
	Image string `json:"image"` // og:image
	URL   string `json:"url"`   // og:url

	// Common OpenGraph properties
	Description string `json:"description,omitempty"` // og:description
	SiteName    string `json:"siteName,omitempty"`    // og:site_name
	Locale      string `json:"locale,omitempty"`      // og:locale

	// Image properties
	ImageWidth  int    `json:"imageWidth,omitempty"`  // og:image:width
	ImageHeight int    `json:"imageHeight,omitempty"` // og:image:height
	ImageType   string `json:"imageType,omitempty"`   // og:image:type
	ImageAlt    string `json:"imageAlt,omitempty"`    // og:image:alt

	// Article properties (when og:type = "article")
	ArticleAuthor        string    `json:"articleAuthor,omitempty"`        // article:author
	ArticlePublishedTime time.Time `json:"articlePublishedTime,omitempty"` // article:published_time
	ArticleModifiedTime  time.Time `json:"articleModifiedTime,omitempty"`  // article:modified_time
	ArticleSection       string    `json:"articleSection,omitempty"`       // article:section
	ArticleTags          []string  `json:"articleTags,omitempty"`          // article:tag
}

// Metadata represents arbitrary metadata from content extraction
type Metadata map[string]interface{}

type Resource struct {
	ID        *int64                              `json:"id"`
	NoteID    int64                               `json:"note_id"`
	Type      ResourceType                        `json:"type"`
	Source    string                              `json:"source"`
	OpenGraph OpenGraph                           `json:"openGraph" sql:"type:jsonb"`
	Metadata  Metadata                            `json:"metadata" sql:"type:jsonb"`
	UserMeta  map[ResourceMetadataKey]interface{} `json:"-" sql:"type:jsonb"`
	CreatedAt time.Time                           `json:"created_at"`
	UserID    string                              `json:"user_id"`
}

func (r Resource) AddMetadata(key ResourceMetadataKey, value interface{}) {
	if r.UserMeta == nil {
		r.UserMeta = make(map[ResourceMetadataKey]interface{})
	}
	r.UserMeta[key] = value
}

func (r Resource) GetMetadata(key ResourceMetadataKey) interface{} {
	if r.UserMeta == nil {
		return nil
	}
	return r.UserMeta[key]
}

func (r Resource) GetMetadataString(key ResourceMetadataKey) string {
	value := r.GetMetadata(key)
	if str, ok := value.(string); ok {
		return str
	}
	return ""
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

// Note models (from notes package)
type NoteType string

const (
	NoteTypeFUP       NoteType = "fup"
	NoteTypeChatter   NoteType = "chatter"
	NoteTypeKnowledge NoteType = "knowledge"
	NoteTypeNote      NoteType = "note"
)

var validNoteTypes = map[NoteType]struct{}{
	NoteTypeFUP:       {},
	NoteTypeChatter:   {},
	NoteTypeKnowledge: {},
	NoteTypeNote:      {},
}

// IsValid method to use the map
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
	Body       string                          `json:"body"`
	Metadata   map[NoteMetadataKey]interface{} `json:"-" sql:"type:jsonb"`
	UserID     string                          `json:"userId"`
	CreatedAt  time.Time                       `json:"createdAt"`
}

func (n Note) AddMetadata(key NoteMetadataKey, value interface{}) {
	n.Metadata[key] = value
}

func (n Note) GetMetadata(key NoteMetadataKey) interface{} {
	return n.Metadata[key]
}
