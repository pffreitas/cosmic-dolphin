package cosmicdolphin

import (
	"cosmic-dolphin/cosmicswarm"
	cosmicswarmLLM "cosmic-dolphin/cosmicswarm/llm"
	"encoding/json"
)

type CosmicStreamHandler struct {
	ResponseChan chan LLMToken
}

func NewCosmicStreamHandler(responseChan chan LLMToken) *CosmicStreamHandler {
	return &CosmicStreamHandler{
		ResponseChan: responseChan,
	}
}

func (h *CosmicStreamHandler) OnStart() {
	// No action needed on start
}

func (h *CosmicStreamHandler) OnToken(token string) {

}

func (h *CosmicStreamHandler) OnError(err error) {
	h.ResponseChan <- LLMToken{
		Event: "error",
		Data:  err.Error(),
		Done:  true,
	}
}

func (h *CosmicStreamHandler) OnComplete(message cosmicswarmLLM.Message) {
	h.ResponseChan <- LLMToken{
		Event: "complete",
		Data:  message.Content,
		Done:  true,
	}
}

func (h *CosmicStreamHandler) OnToolCall(toolCall cosmicswarmLLM.LLMToolCall) {
	data := map[string]interface{}{
		"tool_call_id": toolCall.ID,
		"tool_name":    toolCall.Function.Name,
	}

	h.ResponseChan <- LLMToken{
		Event: "tool_call",
		Data:  data,
		Done:  false,
	}
}

func (h *CosmicStreamHandler) OnToolCallArguments(toolCallID string, arguments string) {

}

func (h *CosmicStreamHandler) OnLLMStart(messages []cosmicswarmLLM.Message) {
	messagesJson, _ := json.Marshal(messages)
	data := map[string]interface{}{
		"request": string(messagesJson),
	}

	h.ResponseChan <- LLMToken{
		Event: "calling_llm",
		Data:  data,
		Done:  false,
	}
}

func (h *CosmicStreamHandler) OnLLMResponse(message cosmicswarmLLM.Message) {

	messageJson, _ := json.Marshal(message.Content)
	data := map[string]interface{}{
		"response": string(messageJson),
	}

	h.ResponseChan <- LLMToken{
		Event: "llm_response",
		Data:  data,
		Done:  false,
	}
}

func (h *CosmicStreamHandler) OnTaskStart(task *cosmicswarm.Task) {
	data := map[string]interface{}{
		"task_id": task.ID,
	}

	h.ResponseChan <- LLMToken{
		Event: "task_start",
		Data:  data,
		Done:  false,
	}
}

func (h *CosmicStreamHandler) OnTaskComplete(task *cosmicswarm.Task) {
	data := map[string]interface{}{
		"task_id": task.ID,
	}

	h.ResponseChan <- LLMToken{
		Event: "task_complete",
		Data:  data,
		Done:  false,
	}
}

func (h *CosmicStreamHandler) OnTaskError(task *cosmicswarm.Task, err error) {
	data := map[string]interface{}{
		"task_id": task.ID,
		"error":   err.Error(),
	}

	h.ResponseChan <- LLMToken{
		Event: "task_error",
		Data:  data,
		Done:  false,
	}
}

func (h *CosmicStreamHandler) OnTaskMessage(task *cosmicswarm.Task, message cosmicswarmLLM.Message) {
	data := map[string]interface{}{
		"task_id":    task.ID,
		"message":    message.Content,
		"tool_calls": message.ToolCalls,
	}

	h.ResponseChan <- LLMToken{
		Event: "task_message",
		Data:  data,
		Done:  false,
	}
}

func (h *CosmicStreamHandler) OnNextStep(task *cosmicswarm.Task, message cosmicswarmLLM.Message) {
	data := map[string]interface{}{
		"task_id":    task.ID,
		"message":    message.Content,
		"tool_calls": message.ToolCalls,
	}

	h.ResponseChan <- LLMToken{
		Event: "next_step",
		Data:  data,
		Done:  false,
	}
}

func (h *CosmicStreamHandler) OnTokenUsage(usage cosmicswarmLLM.Usage) {
	data := map[string]interface{}{
		"prompt_tokens":     usage.PromptTokens,
		"completion_tokens": usage.CompletionTokens,
		"total_tokens":      usage.TotalTokens,
	}

	h.ResponseChan <- LLMToken{
		Event: "token_usage",
		Data:  data,
		Done:  false,
	}
}
