package pipeline_test

import (
	"cosmic-dolphin/config"
	"cosmic-dolphin/db"
	"cosmic-dolphin/pipeline"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestPipelineRepos(t *testing.T) {

	config.LoadEnv("../.dev.env")
	db.Init()
	defer db.Close()

	t.Run("Test Insert Pipeline", func(t *testing.T) {
		args, err := pipeline.NewArgs(64)
		if err != nil {
			t.Fatal(err)
		}

		refId := int64(1)
		pipe := pipeline.NewPipeline(args, "testUser", &refId)
		pipe, err = pipeline.InsertPipeline(pipe)

		assert.NoError(t, err)
		assert.NotNil(t, pipe.ID)
		assert.Equal(t, "testUser", pipe.UserID)
		assert.Equal(t, &refId, pipe.ReferenceID)
		assert.True(t, !pipe.CreatedAt.IsZero())

		pipeByRef, err := pipeline.GetPipelinesByReferenceID[int](refId)
		assert.NoError(t, err)
		assert.NotNil(t, pipeByRef)
		assert.Equal(t, *pipe.ID, *pipeByRef[0].ID)

		// assert.Equal(t, 1, len(pipe.Stages))
		// assert.Equal(t, pipeline.StageKey("get resource content"), pipe.Stages[0].Key)

		// assert.Greater(t, *pipe.Stages[0].ID, int64(0))
		// assert.Equal(t, pipeline.StageStatusPending, pipe.Stages[0].Status)

		// err = pipeline.UpdateStageStatus(pipe.ID, pipe.Stages[0].ID, pipeline.StageStatusComplete)
		// assert.NoError(t, err)

		// pipe, err = pipeline.GetPipelineByID[int](*pipe.ID)
		// assert.NoError(t, err)
		// assert.NotNil(t, pipe.Stages[0].ID)
		// assert.Equal(t, pipeline.StageStatusComplete, pipe.Stages[0].Status)

		// _, err = pipeline.NewArgs(10)
		// if err != nil {
		// 	t.Fatal(err)
		// }
		// // err = pipeline.UpdatePipelineArgs(pipe.ID, newArgs)
		// // assert.NoError(t, err)

		// pipe, err = pipeline.GetPipelineByID[int](*pipe.ID)
		// assert.NoError(t, err)
		// assert.Equal(t, int(10), pipe.Args.Params)
	})
}
