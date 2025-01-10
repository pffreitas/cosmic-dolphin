package notes

import (
	"context"

	"github.com/riverqueue/river"
)

type NotesPipelines interface {
	Run(noteID int64, userID string) error
}

var notesPipelines []NotesPipelines = []NotesPipelines{}

func AddNotesPipelines(processor NotesPipelines) {
	notesPipelines = append(notesPipelines, processor)
}

type ProcessNoteJobArgs struct {
	NoteID int64
	UserID string
}

func (ProcessNoteJobArgs) Kind() string { return "ProcessNoteJob" }

type ProcessNoteJobWorker struct {
	river.WorkerDefaults[ProcessNoteJobArgs]
}

func (w *ProcessNoteJobWorker) Work(ctx context.Context, job *river.Job[ProcessNoteJobArgs]) error {
	for _, pipe := range notesPipelines {
		err := pipe.Run(job.Args.NoteID, job.Args.UserID)
		if err != nil {
			return err
		}
	}

	return nil
}
