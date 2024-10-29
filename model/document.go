package model

type Document struct {
	ID         int8
	Title      string
	Body       string
	Embeddings []float32
	CreatedAt  string
}
