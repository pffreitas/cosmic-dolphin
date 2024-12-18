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

func (knp KnowledgeNotesProcessor) ProcessNote(noteID int64, userID string) error {
	log.WithFields(logrus.Fields{"note.id": noteID}).Info("[Knowledge] Processing note")

	note, err := notes.GetNoteByID(noteID, userID)
	if err != nil {
		return err
	}

	if note.Type != notes.NoteTypeKnowledge {
		return nil
	}

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
