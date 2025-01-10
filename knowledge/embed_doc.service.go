package knowledge

import (
	"cosmic-dolphin/llm"

	"github.com/sirupsen/logrus"
)

func embedDocument(document Document) error {
	log.WithFields(logrus.Fields{"document.id": document.ID}).Info("Embedding document")

	embeddings, err := llm.GenerateEmbeddings(document.Content)
	if err != nil {
		return err
	}

	for _, embedding := range embeddings {
		_, err = insertEmbedding(Embedding{
			DocumentID: *document.ID,
			Embedding:  embedding.Embeddings,
		})
		if err != nil {
			return err
		}
	}

	log.WithFields(logrus.Fields{"document.id": document.ID}).Info("Document embedded")

	return nil
}
