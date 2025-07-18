package agents

import (
	"fmt"

	"github.com/pffreitas/swarmgo"
)

type FollowUpAgent struct {
	Agent swarmgo.Agent
}

func NewFollowUpAgent() FollowUpAgent {
	agent := swarmgo.Agent{
		Name: "FollowUpAgent",
		Instructions: `
			You are a follow up agent. You can add a follow up item to the follow up heap.
			`,
		Model: "gpt-4.1-mini-2025-04-14",
		Functions: []swarmgo.AgentFunction{
			{
				Name:        "add_follow_up_item",
				Description: "Add a follow up item to the follow up heap.",
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
					return swarmgo.Result{
						Success: true,
						Data:    fmt.Sprintf("Added the following to the follow up heap: %s", prompt),
					}
				},
			},
		},
	}

	return FollowUpAgent{
		Agent: agent,
	}
}
