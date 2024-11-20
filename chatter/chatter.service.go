package chatter

import (
	"cosmic-dolphin/job"
	"cosmic-dolphin/notes"

	"github.com/sirupsen/logrus"
)

func Init() {
	notes.AddNotesProcessor(ChatterNoteProcessor{})
}

type ChatterNoteProcessor struct {
}

func (p ChatterNoteProcessor) ProcessNote(note notes.Note) error {
	body, err := note.GetBody()
	if err != nil {
		return err
	}

	err = job.InsertJob(job.ChatterJobArgs{
		NoteID: *note.ID,
		UserID: note.UserID,
		Input:  body,
	})
	if err != nil {
		logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to insert chatter job")
		return err
	}

	return nil
}

func (p ChatterNoteProcessor) Accepts(note notes.Note) bool {
	return note.Type == notes.NoteTypeChatter
}
