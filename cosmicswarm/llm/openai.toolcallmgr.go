package llm

import (
	"encoding/json"
)

// ToolCallExecution represents a tool call being executed
type ToolCallExecution struct {
	ID         string
	ToolCall   LLMToolCall
	Tool       *ToolDef
	Arguments  map[string]interface{}
	IsComplete bool
}

// ToolCallManager manages tool call execution and tracking
type ToolCallManager struct {
	inProgress map[string]*ToolCallExecution
	processed  map[string]bool
}

// NewToolCallManager creates a new ToolCallManager
func NewToolCallManager() *ToolCallManager {
	return &ToolCallManager{
		inProgress: make(map[string]*ToolCallExecution),
		processed:  make(map[string]bool),
	}
}

// ProcessToolCallDelta processes a streaming tool call delta
func (tcm *ToolCallManager) ProcessToolCallDelta(toolCall LLMToolCall, toolDefs []ToolDef, handler StreamHandler) (*ToolCallExecution, bool) {
	if toolCall.ID == "" {
		return nil, false
	}

	// Skip if already processed
	if tcm.processed[toolCall.ID] {
		return nil, false
	}

	// Get or create execution
	execution, exists := tcm.inProgress[toolCall.ID]
	if !exists {
		execution = &ToolCallExecution{
			ID: toolCall.ID,
			ToolCall: LLMToolCall{
				ID:   toolCall.ID,
				Type: toolCall.Type,
				Function: LLMToolCallFunction{
					Name:      toolCall.Function.Name,
					Arguments: "",
				},
			},
			IsComplete: false,
		}

		// Find the corresponding function
		for _, toolDef := range toolDefs {
			if toolDef.Function.Name == toolCall.Function.Name {
				execution.Tool = &toolDef
				break
			}
		}

		tcm.inProgress[toolCall.ID] = execution
	}

	// Update function name if provided
	if toolCall.Function.Name != "" && execution.ToolCall.Function.Name == "" {
		execution.ToolCall.Function.Name = toolCall.Function.Name

		// Find the corresponding function if not already found
		if execution.Tool == nil {
			for _, toolDef := range toolDefs {
				if toolDef.Function.Name == toolCall.Function.Name {
					execution.Tool = &toolDef
					break
				}
			}
		}
	}

	// Accumulate arguments
	if toolCall.Function.Arguments != "" {
		execution.ToolCall.Function.Arguments += toolCall.Function.Arguments
		// Send the new arguments to the handler as they arrive
		handler.OnToolCallArguments(toolCall.ID, toolCall.Function.Arguments)
	}

	// Try to parse arguments to check if complete
	var args map[string]interface{}
	if err := json.Unmarshal([]byte(execution.ToolCall.Function.Arguments), &args); err == nil {
		execution.Arguments = args
		execution.IsComplete = true
		return execution, true
	}

	return execution, false
}

// MarkAsProcessed marks a tool call as processed
func (tcm *ToolCallManager) MarkAsProcessed(toolCallID string) {
	tcm.processed[toolCallID] = true
	delete(tcm.inProgress, toolCallID)
}
