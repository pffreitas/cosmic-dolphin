package agents

import (
	"context"
	"cosmic-dolphin/config"
	"cosmic-dolphin/llm"
	"cosmic-dolphin/llm/client"
	"cosmic-dolphin/llm/client/openai"
)

type Agent interface {
	SetInput(string)
	GetInput() string

	SetRole(string)

	SetGoal(string)

	SetBackground(string)

	SetTools([]Tool)

	AddTask(message string)

	Run(ctx context.Context, input string) (message string, err error)
}

type Tool struct {
}

func Run() error {
	openAiClient := openai.New(config.GetConfig(config.OpenAIKey))

	resp, err := openAiClient.CreateChatCompletion(context.Background(), client.ChatCompletionRequest{
		Model: client.GPT4,
		Messages: []llm.Message{
			{Role: llm.User, Content: "What is the purpose of life?"},
		},
		MaxTokens:    150,
		Temperature:  0.7,
		CustomParams: map[string]interface{}{},
	})

	if err != nil {
		return err
	}

	for _, choice := range resp.Choices {
		println(choice.Content)
	}

	return nil
}
