package agents

import (
	"context"
	"cosmic-dolphin/llm"
	"cosmic-dolphin/llm/client"
	"fmt"
)

type BaseAgent struct {
	Role           string
	Goal           string
	Background     string
	Tools          []Tool
	Tasks          []string
	Input          string
	ResponseFormat *client.ResponseFormat
	client         client.Client
}

func NewBaseAgent(client client.Client, role string, background string, goal string) BaseAgent {
	baseAgent := BaseAgent{
		client: client,
	}

	baseAgent.SetRole(role)
	baseAgent.SetBackground(background)
	baseAgent.SetGoal(goal)

	return baseAgent
}

func (a *BaseAgent) SetRole(role string) {
	a.Role = role
}

func (a *BaseAgent) SetGoal(goal string) {
	a.Goal = goal
}

func (a *BaseAgent) SetBackground(background string) {
	a.Background = background
}

func (a *BaseAgent) SetTools(tools []Tool) {
	a.Tools = tools
}

func (a *BaseAgent) AddTask(message string) {
	a.Tasks = append(a.Tasks, message)
}

func (a *BaseAgent) SetInput(input string) {
	a.Input = input
}

func (a *BaseAgent) GetInput() string {
	return a.Input
}

func (a *BaseAgent) Run(ctx context.Context, input string) (message string, err error) {
	a.SetInput(input)

	context := fmt.Sprintf(`
		## Role
		%s
		
		## Background
		%s
	`, a.Role, a.Background)

	tools := "## Tools\n"
	for _, tool := range a.Tools {
		tools += fmt.Sprintf("%s\n", tool)
	}

	tasks := "## Tasks to complete\n"
	for _, task := range a.Tasks {
		tasks += fmt.Sprintf("%s\n", task)
	}

	tasks += fmt.Sprintf("## Goal\n%s", a.Goal)

	chatCompletionRequest := client.ChatCompletionRequest{
		Model: client.GPT4O,
		Messages: []llm.Message{
			{Role: llm.System, Content: context},
			{Role: llm.System, Content: tools},
			{Role: llm.User, Content: tasks},
		},
	}

	if a.ResponseFormat != nil {
		chatCompletionRequest.ResponseFormat = a.ResponseFormat
	}

	resp, err := a.client.CreateChatCompletion(ctx, chatCompletionRequest)

	if err != nil {
		return "", err
	}

	res := ""
	for _, choice := range resp.Choices {
		res += choice.Content
	}

	return res, nil
}
