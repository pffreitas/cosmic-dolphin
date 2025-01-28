package pipeline_test

import (
	"context"
	"cosmic-dolphin/config"
	"cosmic-dolphin/cosmictesting"
	"cosmic-dolphin/db"
	"cosmic-dolphin/pipeline"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"

	cdhttp "cosmic-dolphin/http"

	cosmicdolphinapi "github.com/pffreitas/cosmic-dolphin-api-go"
)

type PipelineTestArgs struct {
}

type TestPipelineResult string

const (
	TestPipelineSuccess TestPipelineResult = "success"
	TestPipelineFailed  TestPipelineResult = "failed"
)

func NewPipelineSpec(res TestPipelineResult) *pipeline.PipelineSpec[PipelineTestArgs] {
	spec := pipeline.NewPipelineSpec[PipelineTestArgs]("test-pipeline")

	spec.AddStageHandler("test-stage-1", func(args pipeline.Args[PipelineTestArgs]) (pipeline.Args[PipelineTestArgs], error) {
		return args, nil
	})

	spec.AddStageHandler("test-stage-2", func(args pipeline.Args[PipelineTestArgs]) (pipeline.Args[PipelineTestArgs], error) {
		if res == TestPipelineFailed {
			return args, assert.AnError
		}
		return args, nil
	})

	return spec
}

func TestPipelineEndpoints(t *testing.T) {
	config.LoadEnv("../.dev.env")

	db.Init()

	router := cdhttp.SetupRouter()
	testServer := httptest.NewServer(router)

	apiClient, err := cosmictesting.NewCosmicAPIClient(testServer.URL)
	if err != nil {
		t.Fatal(err)
	}

	t.Cleanup(func() {
		db.Close()
		testServer.Close()
	})

	t.Run("Successfully find pipeline by ref id", func(t *testing.T) {
		refId := int64(1)

		err := pipeline.DeletePipelinesByReferenceID(refId)
		assert.NoError(t, err)

		args, err := pipeline.NewArgs(PipelineTestArgs{})
		assert.NoError(t, err)

		pipe := pipeline.NewPipeline(args, "", &refId)
		pipe, err = pipeline.InsertPipeline(pipe)
		assert.NoError(t, err)
		assert.NotNil(t, pipe.ID)

		spec := NewPipelineSpec(TestPipelineSuccess)
		err = spec.Run(pipe)
		assert.NoError(t, err)

		pipes, res, err := apiClient.PipelinesAPI.PipelinesFindByRefId(context.Background(), int32(refId)).Execute()
		assert.NoError(t, err)
		assert.Equal(t, 200, res.StatusCode)
		assert.Equal(t, 1, len(pipes))
		assert.Equal(t, cosmicdolphinapi.COMPLETE, pipes[0].Status)
		assert.Equal(t, refId, *pipes[0].RefId)
		assert.Equal(t, 2, len(pipes[0].Stages))
	})

	t.Run("Failed pipeline", func(t *testing.T) {
		refId := int64(2)

		err := pipeline.DeletePipelinesByReferenceID(refId)
		assert.NoError(t, err)

		args, err := pipeline.NewArgs(PipelineTestArgs{})
		assert.NoError(t, err)

		pipe := pipeline.NewPipeline(args, "", &refId)
		pipe, err = pipeline.InsertPipeline(pipe)
		assert.NoError(t, err)
		assert.NotNil(t, pipe.ID)

		spec := NewPipelineSpec(TestPipelineFailed)
		err = spec.Run(pipe)
		assert.NoError(t, err)

		pipes, res, err := apiClient.PipelinesAPI.PipelinesFindByRefId(context.Background(), int32(refId)).Execute()
		assert.NoError(t, err)
		assert.Equal(t, 200, res.StatusCode)
		assert.Equal(t, 1, len(pipes))
		assert.Equal(t, cosmicdolphinapi.FAILED, pipes[0].Status)
		assert.Equal(t, cosmicdolphinapi.FAILED, pipes[0].Stages[1].Status)
		assert.Equal(t, refId, *pipes[0].RefId)
		assert.Equal(t, 2, len(pipes[0].Stages))
	})

}
