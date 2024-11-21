package notes

import (
	"reflect"

	"github.com/sirupsen/logrus"
)

type NotesProcessor interface {
	ProcessNote(note Note) error
	Accepts(note Note) bool
}

var notesProcessors []NotesProcessor = []NotesProcessor{}

func AddNotesProcessor(processor NotesProcessor) {
	notesProcessors = append(notesProcessors, processor)
}

func CreateNote(body string, noteType NoteType, userID string) (*Note, error) {
	note, err := InsertNote(Note{
		Type:     NoteType(noteType),
		RawBody:  body,
		Sections: []NoteSection{},
		UserID:   userID,
	})

	if err != nil {
		return nil, err
	}

	for _, processor := range notesProcessors {
		logrus.WithField("processor", reflect.TypeOf(processor)).Info("Processing note")
		if processor.Accepts(*note) {
			err := processor.ProcessNote(*note)
			if err != nil {
				logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to process note")
			}
		}
	}

	return note, nil
}
