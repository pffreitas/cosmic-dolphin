package knowledge

import (
	"context"

	"github.com/riverqueue/river"
)

type GetResourceContentJobArgs struct {
	Resource Resource `json:"resource"`
}

func (GetResourceContentJobArgs) Kind() string { return "GetResourceContent" }

type GetResourceContentJobWorker struct {
	river.WorkerDefaults[GetResourceContentJobArgs]
}

func (w *GetResourceContentJobWorker) Work(ctx context.Context, job *river.Job[GetResourceContentJobArgs]) error {

	return nil
}
