package job

import (
	"context"
	"os"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
)

var RiverClient *river.Client[pgx.Tx]
var workers *river.Workers
var dbPool *pgxpool.Pool

func AddWorker[T river.JobArgs](worker river.Worker[T]) {
	if workers == nil {
		workers = river.NewWorkers()
	}

	river.AddWorker(workers, worker)
}

func Run() error {
	ctx := context.Background()

	var err error
	dbPool, err = pgxpool.New(ctx, os.Getenv("PG_CONN"))
	if err != nil {
		return err
	}

	RiverClient, err = river.NewClient(riverpgxv5.New(dbPool), &river.Config{
		Queues: map[string]river.QueueConfig{
			river.QueueDefault: {MaxWorkers: 100},
		},
		Workers:  workers,
		TestOnly: true,
	})
	if err != nil {
		return err
	}

	if err := RiverClient.Start(ctx); err != nil {
		return err
	}

	return nil
}

func Stop() {
	if err := RiverClient.Stop(context.Background()); err != nil {
		// handle error
	}
}
