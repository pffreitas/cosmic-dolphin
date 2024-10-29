package knowledge

import (
	"context"
	"cosmic-dolphin/llm"

	"github.com/riverqueue/river"
	"github.com/sirupsen/logrus"
)

type EmbedDocumentJobArgs struct {
	DocumentID int64
}

func (EmbedDocumentJobArgs) Kind() string { return "EmbedDocument" }

type EmbedDocumentJobWorker struct {
	river.WorkerDefaults[EmbedDocumentJobArgs]
}

func (w *EmbedDocumentJobWorker) Work(ctx context.Context, job *river.Job[EmbedDocumentJobArgs]) error {
	log.WithFields(logrus.Fields{"document.id": job.Args.DocumentID}).Info("Embedding document")

	doc, err := fetchDocumentByID(job.Args.DocumentID)
	if err != nil {
		return err
	}

	embeddings, err := llm.GenerateEmbeddings(doc.Content)
	if err != nil {
		return err
	}

	for _, embedding := range embeddings {
		_, err = insertEmbedding(Embedding{
			DocumentID: *doc.ID,
			Embedding:  embedding.Embeddings,
		})
		if err != nil {
			return err
		}
	}

	return nil
}
