package notes

import (
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
		Title:    "",
		Summary:  "",
		Tags:     "",
		Sections: []NoteSection{NewTextSection("", body)},
		UserID:   userID,
	})

	if err != nil {
		return nil, err
	}

	for _, processor := range notesProcessors {
		if processor.Accepts(*note) {
			err := processor.ProcessNote(*note)
			if err != nil {
				logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to process note")
			}
		}
	}

	return note, nil
}
