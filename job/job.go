package job

import (
	"context"
	"time"

	"cosmic-dolphin/db"

	"github.com/jackc/pgx/v5"
	"github.com/riverqueue/river"
	"github.com/riverqueue/river/riverdriver/riverpgxv5"
	"github.com/sirupsen/logrus"
)

var RiverClient *river.Client[pgx.Tx]
var workers *river.Workers

func AddWorker[T river.JobArgs](worker river.Worker[T]) {
	if workers == nil {
		workers = river.NewWorkers()
	}

	river.AddWorker(workers, worker)
}

func Run() error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	logrus.Info("Starting River client...")

	// Use the existing database pool instead of creating a new one
	RiverClient, err := river.NewClient(riverpgxv5.New(db.DBPool), &river.Config{
		Queues: map[string]river.QueueConfig{
			river.QueueDefault: {MaxWorkers: 100},
		},
		Workers: workers,
		// Remove TestOnly for production use
		// Add poll-only mode for better compatibility with connection pooling
		PollOnly: true,
	})
	if err != nil {
		logrus.WithError(err).Error("Failed to create River client")
		return err
	}

	if err := RiverClient.Start(ctx); err != nil {
		logrus.WithError(err).Error("Failed to start River client")
		return err
	}

	logrus.Info("River client started successfully")
	return nil
}

func Stop() {
	logrus.Info("Stopping River client...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if RiverClient != nil {
		if err := RiverClient.Stop(ctx); err != nil {
			logrus.WithError(err).Error("Error stopping River client")
		} else {
			logrus.Info("River client stopped successfully")
		}
	}
}

func InsertJob(args river.JobArgs) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := RiverClient.Insert(ctx, args, nil)
	if err != nil {
		logrus.WithError(err).WithField("job_kind", args.Kind()).Error("Failed to insert job")
		return err
	}

	logrus.WithField("job_kind", args.Kind()).Debug("Job inserted successfully")
	return nil
}
