package knowledge

import (
	"context"

	"github.com/riverqueue/river"
)

type InsertResourceJobArgs struct {
	Resource Resource `json:"resource"`
}

func (InsertResourceJobArgs) Kind() string { return "InsertResource" }

type InsertResourceJobWorker struct {
	river.WorkerDefaults[InsertResourceJobArgs]
}

func (w *InsertResourceJobWorker) Work(ctx context.Context, job *river.Job[InsertResourceJobArgs]) error {
	err := insertResource(job.Args.Resource)
	if err != nil {
		return err
	}

	return nil
}
