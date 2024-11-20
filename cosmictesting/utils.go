package cosmictesting

import (
	"fmt"
	"time"

	"github.com/riverqueue/river"
)

func WaitForNJobs(subscribeChan <-chan *river.Event, numJobs int) {
	var (
		timeout  = time.Duration(5 * time.Minute)
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
