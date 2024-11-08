package agents_test

import (
	"context"
	"cosmic-dolphin/config"
	"cosmic-dolphin/llm/agents"
	"cosmic-dolphin/llm/client/openai"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSummaryAgent_Run(t *testing.T) {
	config.LoadEnv("../../.dev.env")

	llmClient := openai.New(config.GetConfig(config.OpenAIKey))
	agent := agents.NewSummaryAgent(llmClient)

	input := `Adam Bender, a Principal Software Engineer at Google, shares his journey and responsibilities as a Staff Engineer. He discusses the shift in focus from technical execution to strategic problem-solving, mentorship, and cross-team coordination. Adam emphasizes the importance of clear communication, project management, and reducing complexity to maintain technical health across large-scale projects. Additionally, he highlights the value of building connections, advocating for engineering excellence, and fostering growth within his team. His experiences illustrate the multifaceted role of a Staff Engineer, where leadership extends beyond code to influence, culture, and long-term project vision.`
	ctx := context.Background()

	summary, err := agent.Run(ctx, input)
	assert.NoError(t, err)
	assert.Equal(t, 3, len(summary.Applications))
}
