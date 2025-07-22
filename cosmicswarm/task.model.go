package cosmicswarm

import (
	"cosmic-dolphin/cosmicswarm/llm"
)

type TaskStreamHandler interface {
	llm.StreamHandler
	OnTaskStart(task *Task)
	OnTaskMessage(task *Task, message llm.Message)
	OnTaskComplete(task *Task)
	OnTaskError(task *Task, err error)
	OnNextStep(task *Task, message llm.Message)
}

type TaskExecutionContext struct {
	Messages         []llm.Message
	ContextVariables map[string]interface{}
	Children         map[string]*TaskExecutionContext
}

func NewTaskExecutionContext(messages []llm.Message, contextVariables map[string]interface{}) *TaskExecutionContext {
	return &TaskExecutionContext{
		Messages:         messages,
		ContextVariables: contextVariables,
		Children:         make(map[string]*TaskExecutionContext),
	}
}

func (ec *TaskExecutionContext) GetMessages() []llm.Message {
	if ec.Messages == nil {
		return []llm.Message{}
	}

	if len(ec.Messages) > 2 {
		return ec.Messages[len(ec.Messages)-2:]
	}

	return ec.Messages
}

func (ec *TaskExecutionContext) GetLastMessage() llm.Message {
	if len(ec.Messages) == 0 {
		return llm.Message{}
	}

	return ec.Messages[len(ec.Messages)-1]
}

func (ec *TaskExecutionContext) MergeContextVariables(contextVariables map[string]interface{}) {
	for k, v := range contextVariables {
		ec.ContextVariables[k] = v
	}
}

func (ec *TaskExecutionContext) Fork(key string) *TaskExecutionContext {
	child := NewTaskExecutionContext([]llm.Message{}, ec.ContextVariables)
	ec.Children[key] = child
	return child
}

type TaskTool struct {
	llm.ToolDef
	Run func(args map[string]any, taskExecutionContext *TaskExecutionContext) *TaskResult
}

type TaskResult struct {
	Response  string
	Variables map[string]interface{}
	Error     error
}

type Task struct {
	ID             string
	Instructions   string
	InstructionsFn func(task *Task, contextVariables map[string]interface{}) string
	Tools          []TaskTool
	SubTasks       []*Task
}
