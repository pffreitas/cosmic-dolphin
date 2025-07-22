package llm

import (
	"fmt"
)

func NewLLMClient(apiKey string, provider LLMProvider) (LLM, error) {
	if apiKey == "" {
		return nil, fmt.Errorf("empty API key provided")
	}

	var client LLM

	switch provider {
	case OpenAI:
		client = NewOpenAILLM(apiKey)
	default:
		return nil, fmt.Errorf("unsupported LLM provider: %s", provider)
	}

	// Verify the client was created properly
	if client == nil {
		return nil, fmt.Errorf("failed to initialize LLM client")
	}

	return client, nil
}
