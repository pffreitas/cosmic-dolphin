package agents

import (
	"context"
	"cosmic-dolphin/config"
	"cosmic-dolphin/llm"
	"fmt"

	"github.com/allurisravanth/swarmgo"
	swarmLlm "github.com/allurisravanth/swarmgo/llm"
)

func RunCosmicAgent(context context.Context, userID string, prompt string, cosmicStreamHandler *llm.CosmicStreamHandler) error {
	swarmClient := swarmgo.NewSwarm(config.GetConfig(config.OpenAIKey), swarmLlm.OpenAI)

	agent := &swarmgo.Agent{
		Name:         "Agent",
		Instructions: systemMessage,
		Model:        "gpt-4.1-mini-2025-04-14",
	}

	agent.Instructions = fmt.Sprintf(`
		### Instructions
		Given content enclosed by <content></content> tags, help me extract:
		- a title
		- a one paragraph summary
		- key points
		- take aways
		- 3 practical applications of this knowledge 
		- tags (array of strings)
		- images (array of objects with 'alt' and 'description' properties)k
	`)

	messages := []swarmLlm.Message{
		{
			Role:    swarmLlm.RoleUser,
			Content: prompt,
		},
	}

	err := swarmClient.StreamingResponse(
		context,
		agent,
		messages,
		nil,
		"",
		cosmicStreamHandler,
		true,
	)

	if err != nil {
		return err
	}

	return nil
}
