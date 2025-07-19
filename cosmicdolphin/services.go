package cosmicdolphin

import (
	"github.com/sirupsen/logrus"
)

// Notes service functions (from notes package)

type NotesProcessor interface {
	ProcessNote(noteID int64, userID string) error
}

var notesProcessors []NotesProcessor = []NotesProcessor{}

func AddNotesProcessor(processor NotesProcessor) {
	notesProcessors = append(notesProcessors, processor)
}

func CreateNote(body string, noteType NoteType, userID string) (*Note, error) {
	note, err := InsertNote(Note{
		Type:    noteType,
		RawBody: body,
		Body:    body,
		Tags:    []string{},
		UserID:  userID,
	})

	if err != nil {
		return nil, err
	}

	return note, nil
}

// Knowledge service functions (from knowledge package)

func embedDocument(document Document) error {
	logrus.WithFields(logrus.Fields{"document.id": document.ID}).Info("Embedding document")

	embeddings, err := GenerateEmbeddings(document.Content)
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

	logrus.WithFields(logrus.Fields{"document.id": document.ID}).Info("Document embedded")

	return nil
}
