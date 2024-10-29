package knowledge_test

import (
	"context"
	"cosmic-dolphin/config"
	"cosmic-dolphin/db"
	"cosmic-dolphin/job"
	"cosmic-dolphin/knowledge"
	"fmt"
	"testing"
	"time"

	"github.com/riverqueue/river"
	"github.com/riverqueue/river/rivershared/riversharedtest"
)

func TestAddDocument(t *testing.T) {
	config.LoadEnv("../.dev.env")
	db.Init()

	job.AddWorker(&knowledge.InsertResourceJobWorker{})
	err := job.Run()
	if err != nil {
		t.Fatal(err)
	}

	t.Cleanup(func() {
		job.Stop()
		db.Close()
	})

	t.Run("Post Document", func(t *testing.T) {
		_, err := job.RiverClient.Insert(context.Background(), knowledge.InsertResourceJobArgs{
			Resource: knowledge.Resource{
				ID:     "Test Title",
				Type:   knowledge.ResourceTypeWebPage,
				Source: "https://example.com",
			},
		}, nil)

		if err != nil {
			t.Fatal(err)
		}

		subscribeChan, subscribeCancel := job.RiverClient.Subscribe(river.EventKindJobCompleted)
		defer subscribeCancel()

		waitForNJobs(subscribeChan, 1)
	})

}

func waitForNJobs(subscribeChan <-chan *river.Event, numJobs int) {
	var (
		timeout  = riversharedtest.WaitTimeout()
		deadline = time.Now().Add(timeout)
		events   = make([]*river.Event, 0, numJobs)
	)

	for {
		select {
		case event := <-subscribeChan:
			events = append(events, event)

			if len(events) >= numJobs {
				return
			}

		case <-time.After(time.Until(deadline)):
			panic(fmt.Sprintf("WaitOrTimeout timed out after waiting %s (received %d job(s), wanted %d)",
				timeout, len(events), numJobs))
		}
	}
}
