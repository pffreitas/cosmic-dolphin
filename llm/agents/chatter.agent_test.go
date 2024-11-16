package agents_test

import (
	"context"
	"cosmic-dolphin/config"
	"cosmic-dolphin/llm/agents"
	"cosmic-dolphin/llm/client/openai"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestChatterAgent(t *testing.T) {
	t.Run("Test Chatter Agent - Happy Path", func(t *testing.T) {
		config.LoadEnv("../../.dev.env")

		llmClient := openai.New(config.GetConfig(config.OpenAIKey))
		agent := agents.NewChatterAgent(llmClient)

		input := `Mobile release is delayed for the following countries Affected Country: Argentina, Canada, Dominican Republic, Peru, United States. We faced and issue during cart deployment last night on the integration with order transparency service. This issue is related to the activation of order editing. In production order-transparency-service returns order date in a format different from sit/uat and therefore different from what we developed for. We had to update the format on our side, but now we are blocked from deploying because of a backend freeze that in place because of BEES Day (okajima). Next available date for backend deployment is on Monday. Which means we will have to hold app release for the above countries until Monday. `
		ctx := context.Background()

		text, err := agent.Run(ctx, input)
		assert.NoError(t, err)
		assert.NotEmpty(t, text)
		t.Log(">>>>>", text)
	})
}
