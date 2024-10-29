package knowledge_test

import (
	"context"
	"cosmic-dolphin/config"
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

	job.AddWorker(&knowledge.KnowledgeJobWorker{})
	riverClient, err := job.Run()
	if err != nil {
		t.Fatal(err)
	}

	t.Cleanup(func() {
		job.Stop()
	})

	t.Run("Post Document", func(t *testing.T) {
		_, err := riverClient.Insert(context.Background(), knowledge.KnowledgeJobArgs{
			Strings: []string{"whale", "tiger", "bear"},
		}, &river.InsertOpts{
			MaxAttempts: 3,
		})

		if err != nil {
			t.Fatal(err)
		}

		subscribeChan, subscribeCancel := riverClient.Subscribe(river.EventKindJobCompleted)
		defer subscribeCancel()

		waitForNJobs(subscribeChan, 1)
		// var jobState rivertype.JobState
		// for jobState == "success" {
		// 	fmt.Println("Waiting for job state to change from success...")
		// 	time.Sleep(1 * time.Second)

		// 	job, err := riverClient.JobGet(context.Background(), res.Job.ID)
		// 	if err != nil {
		// 		fmt.Println("err", err)
		// 		t.Fail()
		// 	}

		// 	jobState = job.State

		// 	fmt.Println("Job state changed:", jobState)
		// }

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
