package cosmicdolphin

import (
	"github.com/pffreitas/swarmgo"
	"github.com/sirupsen/logrus"
)

var summaryAgentSystemMessage = `
You are tasked with creating an objective summary of the provided content. Your goal is to distill the main ideas, key points, and practical applications from the given text. Follow these instructions carefully:

1. Read and analyze the following content:

<content>
{{CONTENT}}
</content>

2. Create a summary with the following sections:

- Title: A concise, descriptive title for the content
- Summary: A brief overview of the main ideas (2-3 sentences)
- Key Points: 3-5 bullet points highlighting the most important information
- Takeaways: 2-3 main lessons or insights from the content
- Practical Applications: 3 ways this knowledge can be applied in real-world situations

3. Generate metadata for the summary:

- Title: The same title used in the summary
- Summary: A condensed version of the summary section (1-2 sentences)
- Tags: 3-5 relevant keywords or phrases
- Images: For each <img> tag in the content:
  - Extract the 'alt' attribute
  - Describe the image in a sentence
  - Incorporate the image description into your analysis of the text

4. Format your output as follows:

For the body:
'''markdown
## [Title]

[Summary]

## Key Points

[Bullet points]

## Takeaways

[Bullet points]

## Practical Applications

[Numbered list]
'''

For the metadata:
- title: [string]
- summary: [string]
- tags: [array of strings]
- images: [array of objects with 'alt' and 'description' properties]

5. Important requirements:

- Generate the body content first, then the metadata.
- Use markdown format for the body content.
- Do not include any text other than the markdown output.
- Do not enclose the output in '''markdown''' blocks.

6. After generating both the body and metadata, call the 'update_note' function with the following parameters:

- body: The full markdown output
- title: The title string
- summary: The summary string
- tags: The array of tag strings
- images: The array of image objects

Your final output should only be the function call to 'update_note' with the generated information. Do not include any other text or explanations.
`

type SummaryAgent struct {
	Agent swarmgo.Agent
}

func NewSummaryAgent() SummaryAgent {
	agent := swarmgo.Agent{
		Name:         "SummaryAgent",
		Instructions: summaryAgentSystemMessage,
		Model:        "gpt-4.1-mini-2025-04-14",
		Functions: []swarmgo.AgentFunction{
			{
				Name:        "upate_note",
				Description: "Update note (article summarization) with the generated information in the database.",
				Function: func(args map[string]interface{}, contextVariables map[string]interface{}) swarmgo.Result {
					logrus.WithFields(logrus.Fields{"body": args["body"]}).Info("Tool Call - Updating note")

					noteId := contextVariables["note_id"].(int64)
					userID := contextVariables["user_id"].(string)
					note, err := GetNoteByID(noteId, userID)
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

					err = UpdateNote(*note)
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

	return SummaryAgent{
		Agent: agent,
	}
}
