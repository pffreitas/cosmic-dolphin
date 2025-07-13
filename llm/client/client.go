package client

import (
	"context"
	"cosmic-dolphin/llm"
	"encoding/json"
	"fmt"
	"io"
)

type Model string

const (
	GPT432K0314       Model = "gpt-4-32k-0314"
	GPT432K           Model = "gpt-4-32k"
	GPT40314          Model = "gpt-4-0314"
	GPT4                    = "gpt-4"
	GPT3Dot5Turbo0301       = "gpt-3.5-turbo-0301"
	GPT3Dot5Turbo           = "gpt-3.5-turbo"
	GPT4O                   = "gpt-4o-2024-08-06"
	GPT41Mini               = "gpt-4.1-mini-2025-04-14"
)

// RetryableError is an error from the API that can be retried.
type RetryableError struct {
	originalError error
}

func (r RetryableError) Error() string {
	return fmt.Sprintf("retryable: %v", r.originalError)
}

func (r RetryableError) Unwrap() error {
	return r.originalError
}

func Retryable(err error) error {
	return &RetryableError{
		originalError: err,
	}
}

// FIXME(ryszard): What about N?

type ResponseFormat struct {
	Schema json.Marshaler
}

type ChatCompletionRequest struct {
	Model       string        `json:"model"`
	Messages    []llm.Message `json:"messages"`
	MaxTokens   int           `json:"max_tokens"`
	Temperature float32       `json:"temperature"`
	// This is an escape hatch for passing arbitrary parameters to the APIs. It
	// is the client's responsibility to ensure that the parameters are valid
	// for the model.
	CustomParams map[string]interface{} `json:"params"`

	// If Stream is not nil, the client will use the streaming API. The client
	// should write the message content from the server as it appears on the
	// wire to Stream, and then still return the whole message.
	Stream io.Writer `json:"-"` // This should not be used when hashing.

	ResponseFormat *ResponseFormat `json:"response_format"`
}

type ChatCompletionResponse struct {
	Choices []llm.Message `json:"choices"`
}

func (r ChatCompletionRequest) WantsStreaming() bool {
	return r.Stream != nil
}

// Client is an interface for the LLM API client. Any methods that return errors
// should return a RetryableError (by calling Retryable) if the error is
// retryable, or any other error if it is not.
type Client interface {
	CreateChatCompletion(ctx context.Context, req ChatCompletionRequest) (ChatCompletionResponse, error)

	// TODO(ryszard): Implement this.
	//SupportedParameters() []string
}
