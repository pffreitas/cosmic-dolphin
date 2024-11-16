package knowledge

import (
	"cosmic-dolphin/chatter"
	"cosmic-dolphin/job"

	"github.com/sirupsen/logrus"
)

func createNote(body string, noteType string, userID string) (*Note, error) {
	note, err := insertNote(Note{
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
		err = job.InsertJob(chatter.ChatterJobArgs{
			NoteID: *note.ID,
		})
		if err != nil {
			logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to insert chatter job")
			return nil, err
		}
	}

	return note, nil
}
