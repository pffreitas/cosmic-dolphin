package cosmicdolphin

import (
	"context"
	"cosmic-dolphin/config"
	"fmt"

	"github.com/pffreitas/swarmgo"
	swarmLlm "github.com/pffreitas/swarmgo/llm"
)

type CosmicAgent struct {
	Agent swarmgo.Agent
}

func NewCosmicAgent() CosmicAgent {

	return CosmicAgent{
		Agent: swarmgo.Agent{
			Name:         "CosmicAgent",
			Instructions: cosmicAgentSystemMessage,
		},
	}
}

var cosmicAgentSystemMessage = `
You are Cosmic Dolphin, an AI assistant that helps users organize and understand their knowledge and get things done.
You are given a prompt and you need to use your sub-agents to help the user.

You have the following sub-agents:
- SummaryAgent: Can fetch the contents of a link, summarize the given text and update the note in the database.
- ChatterAgent: Can chat with the user and help them with their questions.
- FollowUpAgent: Can follow up with the user and help them with their questions.

You can route tasks to the following agents:
- SummaryAgent (summary_agent): You must hand over the control to this agent when the user references a link (url). 
- ChatterAgent (chatter_agent): You must hand over the control to this agent when the user wants to chat with the assistant.
- FollowUpAgent (follow_up_agent): You must hand over the control to this agent when the user uses the tag @fup. The follow up agent can add a follow up item to the follow up heap. 

`

func (c *CosmicAgent) Run(context context.Context, prompt string, contextVariables map[string]interface{}, cosmicStreamHandler *CosmicStreamHandler) error {

	agent := &swarmgo.Agent{
		Name:         "CosmicAgent",
		Instructions: cosmicAgentSystemMessage,
		Model:        "gpt-4.1-mini-2025-04-14",
		Functions: []swarmgo.AgentFunction{
			{
				Name:        "summary_agent",
				Description: "Called when the user references a link (url). This agent can fetch the contents of that link, summarize the given text and update the note in the database.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"url": map[string]any{
							"type":        "string",
							"description": "The url of the link to summarize",
						},
					},
				},
				Function: func(args map[string]interface{}, contextVariables map[string]interface{}) swarmgo.Result {
					url := args["url"].(string)
					noteID := contextVariables["note_id"].(int64)
					userID := contextVariables["user_id"].(string)

					_, textContent, err := ProcessResource(noteID, userID, url)
					if err != nil {
						return swarmgo.Result{
							Success: false,
							Data:    err.Error(),
						}
					}

					summaryAgent := NewSummaryAgent()
					return swarmgo.Result{
						Success: true,
						Agent:   &summaryAgent.Agent,
						Data:    fmt.Sprintf("<content>%s</content>", string(textContent)),
					}
				},
			},
			{
				Name:        "follow_up_agent",
				Description: "Called when the user wants to add a follow up item to the follow up heap.",
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"prompt": map[string]any{
							"type":        "string",
							"description": "The prompt to add to the follow up heap",
						},
					},
				},
				Function: func(args map[string]interface{}, contextVariables map[string]interface{}) swarmgo.Result {
					prompt := args["prompt"].(string)
					followUpAgent := NewFollowUpAgent()
					return swarmgo.Result{
						Success: true,
						Agent:   &followUpAgent.Agent,
						Data:    fmt.Sprintf("Add the following to the follow up heap: %s", prompt),
					}
				},
			},
		},
	}

	swarmClient := swarmgo.NewSwarm(config.GetConfig(config.OpenAIKey), swarmLlm.OpenAI)
	messages := []swarmLlm.Message{
		{
			Role:    swarmLlm.RoleUser,
			Content: prompt,
		},
	}

	cosmicStreamHandler.OnToken("About to call the cosmic agent...")

	err := swarmClient.StreamingResponse(
		context,
		agent,
		messages,
		contextVariables,
		"",
		cosmicStreamHandler,
		true,
	)

	if err != nil {
		return err
	}

	return nil
}
