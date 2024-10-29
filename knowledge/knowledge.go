package knowledge

import (
	"context"
	"fmt"
	"sort"

	"github.com/riverqueue/river"
)

type KnowledgeJobArgs struct {
	Strings []string `json:"strings"`
}

func (KnowledgeJobArgs) Kind() string { return "knowledge" }

type KnowledgeJobWorker struct {
	// An embedded WorkerDefaults sets up default methods to fulfill the rest of
	// the Worker interface:
	river.WorkerDefaults[KnowledgeJobArgs]
}

func (w *KnowledgeJobWorker) Work(ctx context.Context, job *river.Job[KnowledgeJobArgs]) error {
	sort.Strings(job.Args.Strings)
	fmt.Printf("Sorted strings: %+v\n", job.Args.Strings)
	return nil
}
