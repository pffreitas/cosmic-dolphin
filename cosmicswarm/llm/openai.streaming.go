package llm

import (
	"context"
	"fmt"
)

func (o *OpenAILLM) RunChatCompletionStream(ctx context.Context, messages []Message, tools []ToolDef, streamHandler StreamHandler) (*Message, error) {
	req := ChatCompletionRequest{
		Model:    "gpt-4.1-mini-2025-04-14",
		Messages: messages,
		Tools:    tools,
	}

	streamHandler.OnLLMStart(messages)

	stream, err := o.CreateChatCompletionStream(ctx, req)
	if err != nil {
		streamHandler.OnError(fmt.Errorf("failed to create chat completion stream: %v", err))
		return nil, err
	}

	message, err := o.processStream(ctx, stream, tools, streamHandler)
	if err != nil {
		streamHandler.OnError(fmt.Errorf("failed to process stream: %v", err))
		return nil, err
	}
	stream.Close()

	streamHandler.OnLLMResponse(*message)

	return message, nil
}

func (o *OpenAILLM) processStream(ctx context.Context, stream ChatCompletionStream, toolsDefs []ToolDef, streamHandler StreamHandler) (*Message, error) {
	message := &Message{
		Role:    RoleAssistant,
		Content: "",
	}

	for {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
			response, err := stream.Recv()
			if err != nil {
				if err.Error() == "EOF" {
					// Check if we have accumulated tool calls to return
					if len(message.ToolCalls) > 0 {
						message.Role = RoleFunction
						return message, nil
					}
					return message, nil
				}
				fmt.Println("Error receiving from stream", "error", err)
				return nil, fmt.Errorf("error receiving from stream: %v", err)
			}

			if len(response.Choices) == 0 {
				continue
			}

			if response.Usage.TotalTokens > 0 {
				streamHandler.OnTokenUsage(response.Usage)
			}

			choice := response.Choices[0]

			// Handle content streaming
			if choice.Message.Content != "" {
				message.Content += choice.Message.Content
				streamHandler.OnToken(choice.Message.Content)
			}

			// Handle tool calls
			if len(choice.Message.ToolCalls) > 0 {
				fmt.Println("Processing tool calls", "tool_calls", choice.Message.ToolCalls)
				err := o.processToolCallsInStream(choice.Message.ToolCalls, toolsDefs, streamHandler, message)
				if err != nil {
					fmt.Println("Failed to process tool calls", "error", err)
					return nil, err
				}
			}
		}
	}
}

// processToolCallsInStream processes tool calls within a stream
func (o *OpenAILLM) processToolCallsInStream(toolCalls []LLMToolCall, toolDefs []ToolDef, streamHandler StreamHandler, message *Message) error {
	for _, toolCall := range toolCalls {
		fmt.Println("Processing tool call", "tool_call_id", toolCall.ID, "tool_call_name", toolCall.Function.Name)

		// Process tool call delta
		execution, isComplete := o.toolCallMgr.ProcessToolCallDelta(toolCall, toolDefs, streamHandler)
		if execution == nil {
			continue
		}

		// If tool call is complete, add it to message
		if isComplete {
			// Mark as processed
			o.toolCallMgr.MarkAsProcessed(execution.ID)

			// Notify stream handler
			streamHandler.OnToolCall(execution.ToolCall)

			// Add to message tool calls (avoid duplicates)
			found := false
			for i, existingToolCall := range message.ToolCalls {
				if existingToolCall.ID == execution.ToolCall.ID {
					// Update existing tool call with complete data
					message.ToolCalls[i] = execution.ToolCall
					found = true
					break
				}
			}
			if !found {
				message.ToolCalls = append(message.ToolCalls, execution.ToolCall)
			}

			// // Execute the tool call
			// var result Result
			// if execution.Function.TaskFunction != nil {
			// 	result = execution.Function.TaskFunction(task, execution.Arguments, executionContext.ContextVariables)
			// } else {
			// 	result = execution.Function.Function(execution.Arguments, executionContext.ContextVariables)
			// }
			// execution.Result = result

			// // Handle function result
			// var resultContent string
			// if execution.Result.Error != nil {
			// 	resultContent = fmt.Sprintf("Error: %v", execution.Result.Error)
			// } else {
			// 	resultContent = fmt.Sprintf("%v", execution.Result.Data)
			// }

			// if execution.Result.Variables != nil {
			// 	executionContext.MergeContextVariables(execution.Result.Variables)
			// }

			// executionContext.AddMessage(functionMessage)

		}
	}

	return nil
}

// func buildLLMTools(functions []AgentFunction) []Tool {
// 	if functions == nil {
// 		return []Tool{}
// 	}

// 	var tools []Tool
// 	for _, af := range functions {
// 		def := FunctionToDefinition(af)
// 		tools = append(tools, Tool{
// 			Type: "function",
// 			Function: &Function{
// 				Name:        def.Name,
// 				Description: def.Description,
// 				Parameters:  def.Parameters,
// 			},
// 		})
// 	}

// 	return tools
// }
