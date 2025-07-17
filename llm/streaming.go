package llm

import swarmLlm "github.com/allurisravanth/swarmgo/llm"

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
	h.ResponseChan <- LLMToken{
		Event: "content",
		Data:  token,
		Done:  false,
	}
}

func (h *CosmicStreamHandler) OnError(err error) {
	h.ResponseChan <- LLMToken{
		Data: err.Error(),
		Done: true,
	}
}

func (h *CosmicStreamHandler) OnComplete(message swarmLlm.Message) {
	h.ResponseChan <- LLMToken{
		Event: "content",
		Done:  true,
	}
}

func (h *CosmicStreamHandler) OnToolCall(toolCall swarmLlm.ToolCall) {
	h.ResponseChan <- LLMToken{
		Data: "",
		Done: false,
	}
}
