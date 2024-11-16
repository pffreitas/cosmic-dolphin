package notes

import (
	"cosmic-dolphin/job"

	"github.com/sirupsen/logrus"
)

func createNote(body string, noteType string, userID string) (*Note, error) {
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

	if noteType == "chatter" {
		err := job.InsertJob(job.ChatterJobArgs{
			NoteID: *note.ID,
			UserID: userID,
			Input:  body,
		})
		if err != nil {
			logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to insert chatter job")
			return nil, err
		}
	}

	return note, nil
}
