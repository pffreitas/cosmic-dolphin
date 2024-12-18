package pipeline_test

import (
	"cosmic-dolphin/config"
	"cosmic-dolphin/db"
	"cosmic-dolphin/pipeline"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
)

type TestInput struct {
	Params     string
	RawBody    string
	ResourceID *int64
	DocumentID *int64
}

const (
	InsertResourceStageKey = "insert resource"
	GetResourceContentKey  = "get resource content"
)

func TestPipeline(t *testing.T) {

	config.LoadEnv("../.dev.env")
	db.Init()

	t.Cleanup(func() {
		db.Close()
	})

	t.Run("Test Run Pipeline", func(t *testing.T) {
		pipeSpec := pipeline.NewPipelineSpec[TestInput]("test-pipe")
		pipeSpec.AddStageHandler(InsertResourceStageKey, func(input pipeline.Args[TestInput]) (pipeline.Args[TestInput], error) {
			fmt.Println("stage 1 >>>>> ", input)
			input.Params.RawBody = "raw body"
			return input, nil
		})

		pipeSpec.AddStageHandler(GetResourceContentKey, func(input pipeline.Args[TestInput]) (pipeline.Args[TestInput], error) {
			fmt.Println("stage 2 >>>>> ", input)
			input.Params.Params = "params"
			return input, nil
		})

		args, err := pipeline.NewArgs(TestInput{Params: "test"})
		if err != nil {
			t.Fatal(err)
		}

		refId := int64(1)
		pipe := pipeline.NewPipeline(args, "user-id", &refId)
		pipe, err = pipeline.InsertPipeline(pipe)
		assert.NoError(t, err)

		err = pipeSpec.Run(pipe)
		assert.NoError(t, err)

		pipe, err = pipeline.GetPipelineByID[TestInput](*pipe.ID)
		assert.NoError(t, err)
		assert.Equal(t, 2, len(pipe.Stages))
		for _, stage := range pipe.Stages {
			assert.Equal(t, pipeline.StageStatusComplete, stage.Status)
		}

		assert.Equal(t, 3, len(pipe.Stages))
	})
}
