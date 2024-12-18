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

type ProcessNotePipelineArgs struct {
	NoteID int64
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

	args, err := pipeline.NewArgs(ProcessNotePipelineArgs{NoteID: *note.ID})
	if err != nil {
		return nil, err
	}

	pipe := pipeline.NewPipeline(args, userID, note.ID)
	pipe, err = pipeline.InsertPipeline(pipe)
	if err != nil {
		return nil, err
	}

	err = job.InsertJob(ProcessNotePipelineJobArgs{
		PipelineID: pipe.ID,
	})
	if err != nil {
		logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to insert chatter job")
		return nil, err
	}

	return note, nil
}
