package agents

import (
	"context"
	"cosmic-dolphin/config"
	"cosmic-dolphin/llm"
	"cosmic-dolphin/notes"
	"fmt"

	"github.com/allurisravanth/swarmgo"
	swarmLlm "github.com/allurisravanth/swarmgo/llm"
	"github.com/sirupsen/logrus"
)

type Summary struct {
	KeyPoints    []string `json:"key-points"`
	TakeAways    []string `json:"take-aways"`
	Applications []string `json:"applications"`
	Title        string   `json:"title"`
	Summary      string   `json:"summary"`
	Tags         []string `json:"tags"`
	Images       []struct {
		Alt        string `json:"alt"`
		Descrption string `json:"description"`
	} `json:"images"`
}

var systemMessage = `
Techinical Writer - Software Enginnering; Enterprise Applications; Modern App Development.
In an increasingly information-rich environment, individuals and organizations need quick, efficient ways to process and comprehend vast amounts of written content. 
From research papers to industry articles and internal documentation, valuable insights can easily be lost in the sheer volume of material.
Traditional methods of skimming or summarizing are time-intensive and often overlook critical points or key themes. 
To address this challenge, an AI-driven Content Summarization Agent can provide an intelligent solution by autonomously analyzing and distilling complex texts.
By identifying key takeaways, essential points, concise summaries, and relevant tags, this Agent enables users to access and organize information more effectively,
making it possible to stay informed and make faster, more data-driven decisions.

The goal of the AI Content Summarization Agent is to empower users with rapid access to essential information by providing accurate, concise, and contextually relevant summaries.
By automating the extraction of key takeaways, main points, and appropriate tags from a variety of content formats, the Agent enhances information accessibility, 
streamlines content discovery, and supports data-informed decision-making. Ultimately, this tool aims to reduce time spent on content analysis, improve organizational efficiency, 
and facilitate knowledge sharing across teams and domains.
`

func RunSummaryAgent(noteId int64, userID string, input string, cosmicStreamHandler *llm.CosmicStreamHandler) error {
	swarmClient := swarmgo.NewSwarm(config.GetConfig(config.OpenAIKey), swarmLlm.OpenAI)

	agent := &swarmgo.Agent{
		Name:         "Agent",
		Instructions: systemMessage,
		Model:        "gpt-4.1-mini-2025-04-14",
		Functions: []swarmgo.AgentFunction{
			{
				Name:        "upate_note",
				Description: "Update note (article summarization) with the generated information in the database.",
				Function: func(args map[string]interface{}, contextVariables map[string]interface{}) swarmgo.Result {
					logrus.WithFields(logrus.Fields{"body": args["body"]}).Info("Tool Call - Updating note")

					noteId := contextVariables["note_id"].(int64)
					userID := contextVariables["user_id"].(string)
					note, err := notes.GetNoteByID(noteId, userID)
					if err != nil {
						return swarmgo.Result{
							Success: false,
							Data:    err.Error(),
						}
					}

					if args["body"] != nil {
						note.Body = args["body"].(string)
					}

					// Convert []interface{} to []string, handle nil case
					var tags []string
					if args["tags"] != nil {
						tagsInterface := args["tags"].([]interface{})
						tags = make([]string, len(tagsInterface))
						for i, v := range tagsInterface {
							if v != nil {
								tags[i] = v.(string)
							}
						}
					}
					note.Tags = tags

					if args["summary"] != nil {
						note.Summary = args["summary"].(string)
					}
					if args["title"] != nil {
						note.Title = args["title"].(string)
					}

					err = notes.UpdateNote(*note)
					if err != nil {
						return swarmgo.Result{
							Success: false,
							Data:    err.Error(),
						}
					}
					return swarmgo.Result{
						Success: true,
						Data:    "Note updated successfully",
					}
				},
				Parameters: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"title": map[string]any{
							"type":        "string",
							"description": "The title of the article",
						},
						"summary": map[string]any{
							"type":        "string",
							"description": "The summary of the article",
						},
						"body": map[string]any{
							"type":        "string",
							"description": "The body of the article, the full generated output in markdown format",
						},
						"tags": map[string]any{
							"type":        "array",
							"description": "The tags of the article",
							"items": map[string]any{
								"type": "string",
							},
						},
					},
				},
			},
		},
	}

	agent.Instructions = fmt.Sprintf(`
		### Instructions
		Given content enclosed by <content></content> tags, help me extract:
		- a title
		- a one paragraph summary
		- key points
		- take aways
		- 3 practical applications of this knowledge 
		- tags (array of strings)
		- images (array of objects with 'alt' and 'description' properties)

		for the images, when you find a <img> tag:
		- extract the 'alt' attribute
		- describe the image in a sentence
		- incorporate the description of the image in the analisys of the text

		### Requirements
		- You MUST generate the output in markdown format.
		- You MUST NOT include any other text than the markdown output.
		- You MUST NOT enclose the output in '''markdown''' block.
		- You MUST call the 'upate_note' function with the generated information. Make sure to include the full generated output in the 'body' field. 
		- You MUST call the 'update_note' function passing the full generated MARKDOWN output in the 'body' field and the title, summary, tags, and images.

		### Article
		<content>
		%s
		</content>
		`, input)

	messages := []swarmLlm.Message{}
	contextVariables := map[string]interface{}{
		"note_id": noteId,
		"user_id": userID,
	}

	err := swarmClient.StreamingResponse(
		context.Background(),
		agent,
		messages,
		contextVariables,
		"",
		cosmicStreamHandler,
		true,
	)

	if err != nil {
		return err
	}

	return nil
}
