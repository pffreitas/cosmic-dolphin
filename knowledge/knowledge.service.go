package knowledge

import (
	"cosmic-dolphin/job"
	"cosmic-dolphin/notes"
	"time"

	"github.com/sirupsen/logrus"
)

var log = logrus.New()

func Init() {
	notes.AddNotesProcessor(KnowledgeNotesProcessor{})
	job.AddWorker(&GetResourceContentJobWorker{})
	job.AddWorker(&EmbedDocumentJobWorker{})
	job.AddWorker(&SummarizeJobWorker{})
}

type KnowledgeNotesProcessor struct{}

func (knp KnowledgeNotesProcessor) ProcessNote(note notes.Note) error {
	log.WithFields(logrus.Fields{"note.id": *note.ID}).Info("[Knowledge] Processing note")

	resource := Resource{
		NoteID:    *note.ID,
		Type:      ResourceTypeWebPage,
		Source:    note.RawBody,
		CreatedAt: time.Now(),
		UserID:    note.UserID,
	}

	persistedResource, err := insertResource(resource)
	if err != nil {
		return err
	}

	err = job.InsertJob(GetResourceContentJobArgs{
		Resource: *persistedResource,
	})
	if err != nil {
		return err
	}

	return nil
}

func (knp KnowledgeNotesProcessor) Accepts(note notes.Note) bool {
	return note.Type == notes.NoteTypeKnowledge
}

func processDocument(document Document) error {
	log.WithFields(logrus.Fields{"document.title": document.Title}).Info("Processing document")

	persistedDoc, err := insertDocument(document)
	if err != nil {
		return err
	}

	err = job.InsertJob(EmbedDocumentJobArgs{
		DocumentID: *persistedDoc.ID,
	})
	if err != nil {
		log.WithFields(logrus.Fields{"error": err}).Error("Failed to insert embed document job")
		return err
	}

	return nil
}
