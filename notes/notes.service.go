package notes

import (
	"cosmic-dolphin/job"
	"cosmic-dolphin/pipeline"

	"github.com/sirupsen/logrus"
)

type NotesProcessor interface {
	ProcessNote(noteID int64, userID string) error
}

var notesProcessors []NotesProcessor = []NotesProcessor{}

func AddNotesProcessor(processor NotesProcessor) {
	notesProcessors = append(notesProcessors, processor)
}

func CreateNote(body string, noteType NoteType, userID string) (*Note, error) {
	note, err := InsertNote(Note{
		Type:     noteType,
		RawBody:  body,
		Sections: []NoteSection{},
		UserID:   userID,
	})

	if err != nil {
		return nil, err
	}

	err = job.InsertJob(ProcessNoteJobArgs{
		NoteID: *note.ID,
		UserID: userID,
	})
	if err != nil {
		logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to insert process note job")
		return nil, err
	}

	pipelines, err := pipeline.GetPipelinesByReferenceID[any](*note.ID)
	if err != nil {
		logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to fetch pipelines for note")
		return nil, err
	}
	note.Pipelines = pipelines

	return note, nil
}
