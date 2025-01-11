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

func NewCosmicAPIClient(serverUrl string) (*cosmicdolphinapi.APIClient, error) {
	token, err := cosmictesting.GenerateJWT()
	if err != nil {
		return nil, err
	}

	cfg := cosmicdolphinapi.NewConfiguration()
	cfg.Servers = cosmicdolphinapi.ServerConfigurations{
		{
			URL: serverUrl,
		},
	}
	cfg.AddDefaultHeader("Authorization", token)

	return cosmicdolphinapi.NewAPIClient(cfg), nil
}

type PipelineTestArgs struct {
}

func TestPipelineEndpoints(t *testing.T) {
	config.LoadEnv("../.dev.env")

	db.Init()

	router := cdhttp.SetupRouter()
	testServer := httptest.NewServer(router)

	apiClient, err := NewCosmicAPIClient(testServer.URL)
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

		pipes, res, err := apiClient.PipelinesAPI.PipelinesFindPipelinesByRefId(context.Background(), int32(refId)).Execute()
		assert.NoError(t, err)
		assert.Equal(t, 200, res.StatusCode)
		assert.Equal(t, 1, len(pipes))
	})

}
