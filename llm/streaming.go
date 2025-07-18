package llm

import (
	"github.com/sirupsen/logrus"

	"github.com/pffreitas/swarmgo"
	swarmLlm "github.com/pffreitas/swarmgo/llm"
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
	logrus.Info("OnToken: ", token)
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
		Data:  message.Content,
		Event: "complete",
		Done:  true,
	}
}

func (h *CosmicStreamHandler) OnToolCall(toolCall swarmLlm.ToolCall) {
	h.ResponseChan <- LLMToken{
		Event: "content",
		Data:  "Called tool: " + toolCall.Function.Name,
		Done:  false,
	}
}

func (h *CosmicStreamHandler) OnAgentTransition(fromAgent, toAgent *swarmgo.Agent, depth int) {
	h.ResponseChan <- LLMToken{
		Event: "content",
		Data:  "Transitioned to agent: " + toAgent.Name,
		Done:  false,
	}
}

func (h *CosmicStreamHandler) OnAgentReturn(fromAgent, toAgent *swarmgo.Agent, depth int) {
	h.ResponseChan <- LLMToken{
		Event: "content",
		Data:  "Returned to agent: " + fromAgent.Name,
		Done:  false,
	}
}

func (h *CosmicStreamHandler) OnContextTransfer(context map[string]interface{}) {
	h.ResponseChan <- LLMToken{
		Event: "content",
		Data:  "Transferred context",
		Done:  false,
	}
}

func (h *CosmicStreamHandler) OnDepthLimitReached(maxDepth int) {
	h.ResponseChan <- LLMToken{
		Event: "content",
		Data:  "Depth limit reached",
		Done:  false,
	}
}

func (h *CosmicStreamHandler) OnFunctionCallLimitReached(maxCalls int) {
	h.ResponseChan <- LLMToken{
		Event: "content",
		Data:  "Function call limit reached",
		Done:  false,
	}
}
