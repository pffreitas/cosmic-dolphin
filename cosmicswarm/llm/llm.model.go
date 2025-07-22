package llm

import (
	"context"
)

// Role represents the role of a message participant
type Role string

const (
	RoleSystem    Role = "system"
	RoleUser      Role = "user"
	RoleAssistant Role = "assistant"
	RoleFunction  Role = "function"
	RoleTool      Role = "tool"
)

// LLMProvider represents different LLM providers
type LLMProvider string

const (
	OpenAI          LLMProvider = "OPEN_AI"
	Azure           LLMProvider = "AZURE"
	AzureAD         LLMProvider = "AZURE_AD"
	CloudflareAzure LLMProvider = "CLOUDFLARE_AZURE"
	Gemini          LLMProvider = "GEMINI"
	Claude          LLMProvider = "CLAUDE"
	Ollama          LLMProvider = "OLLAMA"
	DeepSeek        LLMProvider = "DEEPSEEK"
)

// Message represents a single message in a chat conversation
type Message struct {
	Role      Role          `json:"role"`
	Content   string        `json:"content"`
	Name      string        `json:"name"`
	ToolCalls []LLMToolCall `json:"tool_calls"`
}

// ChatCompletionRequest represents a generic request for chat completion
type ChatCompletionRequest struct {
	Model            string    `json:"model"`
	Messages         []Message `json:"messages"`
	Temperature      float32   `json:"temperature,omitempty"`
	TopP             float32   `json:"top_p,omitempty"`
	N                int       `json:"n,omitempty"`
	Stop             []string  `json:"stop,omitempty"`
	MaxTokens        int       `json:"max_tokens,omitempty"`
	PresencePenalty  float32   `json:"presence_penalty,omitempty"`
	FrequencyPenalty float32   `json:"frequency_penalty,omitempty"`
	User             string    `json:"user,omitempty"`
	Tools            []ToolDef `json:"tools,omitempty"`
	Stream           bool      `json:"stream,omitempty"`
}

// ChatCompletionResponse represents a generic response from chat completion
type ChatCompletionResponse struct {
	ID      string   `json:"id"`
	Choices []Choice `json:"choices"`
	Usage   Usage    `json:"usage"`
}

// Choice represents a completion choice
type Choice struct {
	Index        int     `json:"index"`
	Message      Message `json:"message"`
	FinishReason string  `json:"finish_reason"`
}

// Usage represents token usage
type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// LLM defines the interface that all LLM providers must implement
type LLM interface {
	CreateChatCompletion(ctx context.Context, req ChatCompletionRequest) (ChatCompletionResponse, error)
	CreateChatCompletionStream(ctx context.Context, req ChatCompletionRequest) (ChatCompletionStream, error)
	RunChatCompletionStream(ctx context.Context, messages []Message, toolDefs []ToolDef, streamHandler StreamHandler) (*Message, error)
}

// ChatCompletionStream represents a streaming response
type ChatCompletionStream interface {
	Recv() (ChatCompletionResponse, error)
	Close() error
}

// Tool represents a function that can be called by the LLM
type ToolDef struct {
	Type     string           `json:"type"`
	Function *ToolFunctionDef `json:"function,omitempty"`
}

// Function represents a function definition
type ToolFunctionDef struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Parameters  map[string]interface{} `json:"parameters"`
}

// ToolCall represents a tool/function call from the LLM
type LLMToolCall struct {
	ID       string              `json:"id"`
	Type     string              `json:"type"`
	Function LLMToolCallFunction `json:"function"`
}

type LLMToolCallFunction struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

type StreamHandler interface {
	OnStart()
	OnLLMStart(messages []Message)
	OnLLMResponse(message Message)
	OnToken(token string)
	OnToolCall(toolCall LLMToolCall)
	OnToolCallArguments(toolCallID string, arguments string)
	OnComplete(message Message)
	OnError(err error)
	OnTokenUsage(usage Usage)
}
