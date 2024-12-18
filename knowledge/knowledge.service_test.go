package knowledge

import (
	"cosmic-dolphin/config"
	"cosmic-dolphin/db"
	"cosmic-dolphin/job"
	"fmt"
	"testing"
	"time"

	"github.com/riverqueue/river"
)

func TestAddDocument(t *testing.T) {
	config.LoadEnv("../.dev.env")
	db.Init()

	job.AddWorker(&GetResourceContentJobWorker{})
	job.AddWorker(&EmbedDocumentJobWorker{})
	job.AddWorker(&SummarizeJobWorker{})
	err := job.Run()
	if err != nil {
		t.Fatal(err)
	}

	t.Cleanup(func() {
		job.Stop()
		db.Close()
	})

	t.Run("Insert Resource", func(t *testing.T) {
		subscribeChan, subscribeCancel := job.RiverClient.Subscribe(river.EventKindJobCompleted)
		defer subscribeCancel()

		err := processResource(Resource{
			Type:   ResourceTypeWebPage,
			Source: "https://www.docker.com/blog/model-based-testing-testcontainers-jqwik/?ref=dailydev",
			UserID: "Foo",
		})

		if err != nil {
			t.Fatal(err)
		}

		waitForNJobs(subscribeChan, 2)
		time.Sleep(50 * time.Second)
	})

}

func waitForNJobs(subscribeChan <-chan *river.Event, numJobs int) {
	var (
		timeout  = time.Duration(5 * time.Minute)
		deadline = time.Now().Add(timeout)
		events   = make([]*river.Event, 0, numJobs)
	)

	for {
		select {
		case event := <-subscribeChan:
			fmt.Println(">>>>> ", event)
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
