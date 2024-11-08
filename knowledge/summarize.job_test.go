package knowledge_test

import (
	"context"
	"testing"

	"cosmic-dolphin/knowledge"

	"github.com/riverqueue/river"
	"github.com/stretchr/testify/assert"
)

func TestSummarizeJobWorker_Work(t *testing.T) {
	docID := int64(1)

	// Create job worker and job
	worker := &knowledge.SummarizeJobWorker{}
	job := &river.Job[knowledge.SummarizeJobArgs]{Args: knowledge.SummarizeJobArgs{DocumentID: docID}}

	// Execute the Work method
	err := worker.Work(context.Background(), job)

	// Assert results
	assert.NoError(t, err)
}
