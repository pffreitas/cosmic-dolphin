package cosmicswarm

import (
	"context"
	"cosmic-dolphin/cosmicswarm/llm"
	"encoding/json"
	"fmt"
	"strings"
)

type TaskManager struct {
	client        llm.LLM
	Tasks         []*Task
	streamHandler TaskStreamHandler
}

func NewTaskManager(apiKey string, provider llm.LLMProvider, taskStreamHandler TaskStreamHandler) (*TaskManager, error) {
	initializeLoggerWithDefaults()

	client, err := llm.NewLLMClient(apiKey, provider)
	if err != nil {
		return nil, err
	}

	return &TaskManager{
		client:        client,
		Tasks:         make([]*Task, 0),
		streamHandler: taskStreamHandler,
	}, nil
}

func (tm *TaskManager) AddTask(task *Task) {
	tm.Tasks = append(tm.Tasks, task)
}

// Pop removes and returns the first task from the queue (FIFO)
func (tm *TaskManager) PopTask() *Task {
	if len(tm.Tasks) == 0 {
		return nil
	}

	task := tm.Tasks[0]
	tm.Tasks = tm.Tasks[1:]
	return task
}

func (tm *TaskManager) IsEmpty() bool {
	return len(tm.Tasks) == 0
}

// // PlanTask plans the task and returns the execution context
// func (tm *TaskManager) PlanTask(ctx context.Context, task *Task, parentExecutionContext *TaskExecutionContext) *TaskExecutionContext {
// planInstructions := []llm.Message{
// 	{Role: llm.RoleAssistant, Content: `
// 		You are a task planner. Your job is to plan the execution of the task based on the provided instructions.
// 		The provided instructions are enclosed in <task_instructions> tags.
// 		You must return a step by step plan of the task. Make sure the plan is pragmatic and realistic.
// 		Do not include any steps that are not necessary to complete the task.
// 		Do not include any steps that are not possible to complete.
// 		You are creating a plan for yourself, so make sure the plan is realistic and achievable given the tools available to you.
// 		`,
// 	},
// 	{
// 		Role:    llm.RoleUser,
// 		Content: fmt.Sprintf("Plan the task: <task_instructions>%s</task_instructions>", task.Instructions),
// 	},
// }

// instructionsMessage, err := tm.client.RunChatCompletionStream(ctx, planInstructions, nil, tm.streamHandler)
// if err != nil {
// 	tm.streamHandler.OnTaskError(task, err)
// 	return TaskResult{
// 		Error: err,
// 	}
// }
// }

func (tm *TaskManager) ExecuteTask(ctx context.Context, task *Task, parentExecutionContext *TaskExecutionContext) TaskResult {
	tm.streamHandler.OnTaskStart(task)

	// iterate context variables and replace tasks instructions with context variables
	for key, value := range parentExecutionContext.ContextVariables {
		task.Instructions = strings.ReplaceAll(task.Instructions, fmt.Sprintf("{{%s}}", strings.ToUpper(key)), fmt.Sprintf("%v", value))
	}

	executionContext := parentExecutionContext.Fork(task.ID)
	executionContext.Messages = append(parentExecutionContext.Messages, llm.Message{
		Role:    llm.RoleSystem,
		Content: task.Instructions,
	})

	message, err := tm.client.RunChatCompletionStream(ctx, executionContext.Messages, getToolDefs(task), tm.streamHandler)
	if err != nil {
		tm.streamHandler.OnTaskError(task, err)
		return TaskResult{
			Error: err,
		}
	}

	// execute the tool calls
	if len(message.ToolCalls) > 0 {
		for _, toolCall := range message.ToolCalls {
			toolDef := getToolFn(toolCall.Function.Name, task.Tools)
			if toolDef == nil {
				tm.streamHandler.OnTaskError(task, fmt.Errorf("tool %s not found", toolCall.Function.Name))
				return TaskResult{
					Error: fmt.Errorf("tool %s not found", toolCall.Function.Name),
				}
			}
			var toolCallArgs map[string]any
			err := json.Unmarshal([]byte(toolCall.Function.Arguments), &toolCallArgs)
			if err != nil {
				tm.streamHandler.OnTaskError(task, err)
				return TaskResult{
					Error: err,
				}
			}
			toolResult := toolDef.Run(toolCallArgs, executionContext)
			parentExecutionContext.Messages = append(parentExecutionContext.Messages, llm.Message{
				Role:    llm.RoleFunction,
				Name:    toolCall.Function.Name,
				Content: toolResult.Response,
			})
			executionContext.MergeContextVariables(toolResult.Variables)
		}
	}

	tm.streamHandler.OnTaskComplete(task)
	return TaskResult{
		Response:  message.Content,
		Variables: executionContext.ContextVariables,
	}
}

func getToolFn(toolName string, taskTools []TaskTool) *TaskTool {
	for _, tool := range taskTools {
		if tool.ToolDef.Function.Name == toolName {
			return &tool
		}
	}
	return nil
}

func getToolDefs(task *Task) []llm.ToolDef {
	toolDefs := []llm.ToolDef{}
	for _, tool := range task.Tools {
		toolDefs = append(toolDefs, tool.ToolDef)
	}
	return toolDefs
}

func (tm *TaskManager) Execute(ctx context.Context, taskExecutionContext *TaskExecutionContext) error {
	if tm.IsEmpty() {
		return fmt.Errorf("no task to execute")
	}

	for !tm.IsEmpty() {
		task := tm.PopTask()
		taskResult := tm.ExecuteTask(ctx, task, taskExecutionContext)
		if taskResult.Error != nil {
			tm.streamHandler.OnTaskError(task, taskResult.Error)
			return taskResult.Error
		}

		// return to parent task
		taskExecutionContext.Messages = append(taskExecutionContext.Messages, llm.Message{
			Role:    llm.RoleAssistant,
			Content: taskResult.Response,
		})
		taskExecutionContext.MergeContextVariables(taskResult.Variables)
	}

	tm.streamHandler.OnComplete(llm.Message{
		Role:    llm.RoleAssistant,
		Content: "Execution complete",
	})

	return nil
}
