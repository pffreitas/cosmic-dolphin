package cosmicdolphin

import (
	"context"
	"cosmic-dolphin/config"
	"cosmic-dolphin/cosmicswarm"
	cosmicswarmLLM "cosmic-dolphin/cosmicswarm/llm"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

func RunSummaryAgent(ctx context.Context, input string, noteID int64, userID string, streamHandler cosmicswarm.TaskStreamHandler) error {
	taskManager, err := cosmicswarm.NewTaskManager(config.GetConfig(config.OpenAIKey), cosmicswarmLLM.OpenAI, streamHandler)
	if err != nil {
		return fmt.Errorf("failed to create task manager: %v", err)
	}

	taskManager.AddTask(&cosmicswarm.Task{
		ID: "process_resource_from_url",
		Instructions: `
			Call the 'process_resource_from_url' function with the following parameters:
				- url: The url of the article to get the content from
			`,
		Tools: []cosmicswarm.TaskTool{{
			ToolDef: cosmicswarmLLM.ToolDef{
				Type: "function",
				Function: &cosmicswarmLLM.ToolFunctionDef{
					Name:        "process_resource_from_url",
					Description: "Process the resource from the url and return the content",
					Parameters: map[string]any{
						"type": "object",
						"properties": map[string]any{
							"url": map[string]any{
								"type":        "string",
								"description": "The url of the article to get the content from",
							},
						},
					},
				},
			},
			Run: func(args map[string]any, taskExecutionContext *cosmicswarm.TaskExecutionContext) *cosmicswarm.TaskResult {
				url := args["url"].(string)
				noteID := taskExecutionContext.ContextVariables["note_id"].(int64)
				userID := taskExecutionContext.ContextVariables["user_id"].(string)

				_, textContent, err := ProcessResource(noteID, userID, url)
				if err != nil {
					return &cosmicswarm.TaskResult{
						Response: err.Error(),
						Error:    err,
					}
				}

				return &cosmicswarm.TaskResult{
					Response: string(textContent),
					Variables: map[string]interface{}{
						"content": string(textContent),
					},
				}
			},
		}},
	})

	taskManager.AddTask(&cosmicswarm.Task{
		ID: "read_content_and_generate_metadata",
		Instructions: `
			Your task is to generate the metadata for the content. Follow the instructions below step by step:

			1. Read and analyze the following content:
			<content>
			{{CONTENT}}
			</content>

			2. Generate the following metadata for the content:
			- Title: The same title used in the summary
			- Summary: A condensed version of the summary section (1-2 sentences)
			- Tags: 3-5 relevant keywords or phrases
			- Links: For each link in the content execute an analysis like described in step 3.
			- Images: For each <img> tag (or image reference in markdown) in the content execute an analysis like described in step 4.

			3. Analyze ALL links:
			- You must analyze **ALL** the links in the content and provide a context for each link.
			- You must include all links relevant to the content in the output.
			- For each link, provide a brief explanation (1-2 sentences) of why it's relevant and how it relates to the main content

			4. Analyze ALL images and provide context:
			- you must analyze **ALL** the images in the content and provide a context for each image.
			- For each image in the content:
			- Explain the concept illustrated in the image
			- Provide context that links the image to the main article
			- Keep a reference to the image url in the output, like this: ![image description](image_url)

			5. Format the output as follows:
			You must ouput a json object with the following properties:
				- title: [string]
				- summary: [string]
				- tags: [array of strings]
				- link_analysis: [array of objects with 'url' and 'relevance' properties]
				- image_analysis: [array of objects with 'alt' and 'description' properties]

			6. Call the 'update_note' function with the following parameters:
			- metadata:	the json object with the metadata
				- title: The title string
				- summary: The summary string
				- tags: The array of tag strings
				- image_analysis: The array of image objects
				- link_analysis: The array of link objects
			`,
		Tools: []cosmicswarm.TaskTool{updateNoteMetadataFn},
	})

	taskManager.AddTask(&cosmicswarm.Task{
		ID: "read_content_and_summarize",
		Instructions: `
	Your task is to generate the summary for the content. Follow the instructions below step by step:

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
	- Identify follow-up links: Identify a maximum of 3 links within the content that are extremely relevant to the main article and highlight them as follow-up links.

	3. Format the output as follows:
	Your output must be a JSON object with the following properties:
		- body: The complete summary in markdown format (without the '''markdown''' blocks), like this:

		'''markdown
		## [Title]

		[Summary]

		## Key Points

		[Bullet points]

		## Takeaways

		[Bullet points]

		## Practical Applications

		[Numbered list]

		## Follow-up Links

		[Numbered list of links to follow up with explanations]
		'''

	4. Call the 'update_note' function with the following parameters:
	A Json object with the following properties:
		- body: The complete summary in markdown format

	## Important requirements:
	- Use markdown format for the body content.
	- Wrap key terms and concepts in double question marks, like this: ??[key term]??
	- Key concepts and terms are things considered important to the content and that should be highlighted so the reader can easily follow the content.
	- Do not include any text other than the markdown output.
	- Do not enclose the output in '''markdown''' blocks.

			`,
		Tools: []cosmicswarm.TaskTool{updateNoteBodyFn},
	})

	taskManager.AddTask(&cosmicswarm.Task{
		ID: "process_follow_up_links",
		Instructions: `
		Your task is to:
		1. Read the context 
		2. Identify the section "Follow-up links" 
		3. Call the 'process_resource_from_url' function for each one of the follow up links.
		
		## Important requirements:
		- Follow these instructions step by step.
		- Make sure to call the 'process_resource_from_url' function for each one of the follow up links.
		`,
		Tools: []cosmicswarm.TaskTool{
			{
				ToolDef: cosmicswarmLLM.ToolDef{
					Type: "function",
					Function: &cosmicswarmLLM.ToolFunctionDef{
						Name:        "process_resource_from_url",
						Description: "Process the resource from the url and return the content",
						Parameters: map[string]any{
							"type": "object",
							"properties": map[string]any{
								"url": map[string]any{
									"type":        "string",
									"description": "The url of the article to get the content from",
								},
							},
						},
					},
				},
				Run: func(args map[string]any, taskExecutionContext *cosmicswarm.TaskExecutionContext) *cosmicswarm.TaskResult {
					url := args["url"].(string)
					noteID := taskExecutionContext.ContextVariables["note_id"].(int64)
					userID := taskExecutionContext.ContextVariables["user_id"].(string)

					_, _, err := ProcessResource(noteID, userID, url)
					if err != nil {
						return &cosmicswarm.TaskResult{
							Response: err.Error(),
							Error:    err,
						}
					}

					return &cosmicswarm.TaskResult{
						Response: "Follow up link processed successfully",
					}
				},
			}},
	})

	taskManager.AddTask(&cosmicswarm.Task{
		ID: "extract_and_encode_images",
		Instructions: `
		You are given a content that contains images URLs.
		Based on the content, you must determine the images that most relate to the content and are relevant to the understanding of the content.
		You must skip images that are not relevant to the content such as logos, icons, avatars, advertisements, promotional images, etc.

		1. For each image you must gather the following information and call the 'encode_image' function:
		- image_url: The url of the image
		- image_description: The description of the image (html alt attribute from the img tag)
		- image_context: Explanation of how the image is connected to the content. Read the text sourrounding the image to understand how the text makes reference to the image. The context must be a summary basd on the text that explains how the image illustrates the content. You must deterime how this image is used to illustrate the content.
		`,
		Tools: []cosmicswarm.TaskTool{
			{
				ToolDef: cosmicswarmLLM.ToolDef{
					Type: "function",
					Function: &cosmicswarmLLM.ToolFunctionDef{
						Name:        "encode_image",
						Description: "Encode the image into a base64 string",
						Parameters: map[string]any{
							"type": "object",
							"properties": map[string]any{
								"image_url": map[string]any{
									"type":        "string",
									"description": "The url of the image to process",
								},
								"image_description": map[string]any{
									"type":        "string",
									"description": "The description of the image (html alt attribute from the img tag)",
								},
								"image_context": map[string]any{
									"type":        "string",
									"description": "Explanation of how the image is connected to the content. Read the text sourrounding the image to understand how the text makes reference to the image. The context must be a summary basd on the text that explains how the image illustrates the content. You must deterime how this image is used to illustrate the content.",
								},
							},
						},
					},
				},
				Run: func(args map[string]any, taskExecutionContext *cosmicswarm.TaskExecutionContext) *cosmicswarm.TaskResult {
					url, ok := args["image_url"]
					if !ok {
						return &cosmicswarm.TaskResult{
							Response: "Error: url is not set",
							Error:    fmt.Errorf("url is not set"),
						}
					}

					urlString, ok := url.(string)
					if !ok {
						return &cosmicswarm.TaskResult{
							Response: "Error: url is not a string",
							Error:    fmt.Errorf("url is not a string"),
						}
					}

					// Download the image
					response, err := http.Get(urlString)
					if err != nil {
						return &cosmicswarm.TaskResult{
							Response: "Error: failed to download image",
							Error:    fmt.Errorf("failed to download image: %v", err),
						}
					}

					// Read the image
					image, err := io.ReadAll(response.Body)
					if err != nil {
						return &cosmicswarm.TaskResult{
							Response: "Error: failed to read image",
							Error:    fmt.Errorf("failed to read image: %v", err),
						}
					}

					// Encode the image
					encodedImage := base64.StdEncoding.EncodeToString(image)

					encodedImageData := map[string]any{
						"image_url":         urlString,
						"image_description": args["image_description"],
						"image_context":     args["image_context"],
						"encoded_image":     encodedImage,
					}

					encodedImageDataJson, _ := json.Marshal(encodedImageData)

					taskResult := cosmicswarm.TaskResult{
						Response: fmt.Sprintf("Successfully encoded image from url: %s \n <encoded_image>%s</encoded_image>", urlString, encodedImageDataJson),
					}

					return &taskResult
				},
			},
		},
	})

	taskManager.AddTask(&cosmicswarm.Task{
		ID: "store_images",
		Instructions: `
		Take all the images returned by the function "encode_image". Each image carries the following information:
		- image_url: The url of the image
		- image_description: The description of the image
		- image_context: The context of the image
		- encoded_image: base 64 representation of the image
		
		For each image, you must:
		Based on that information, your task is to create a final and comprehensive description of the image. 
		You must read the encoded_image, do a visual analysis of the image and describe it like you would for a blind person.
		Then, with the image in mind, you must create a final description of the image that is relevant to the content.
		The final description must be an explanation of how the image is connected to the content, how it visually explains the ideas in the content and how the image illustrates the content, and how this image is used to illustrate the content.

		Make sure to call the store_image function for each image that was encoded.

		Your output must be call the store_image function with the following parameters:
		- image_url: The url of the image
		- image_title: Generate a title based on the final description of the image.
		- image_context: (Final description, after visual analysis of the encoded image) Explanation of how the image is connected to the content. Read the content to understand the reference to the image. The context must be a summary of the image and how it relates to the content. You must deterime how this image is used to illustrate the content.
		`,
		Tools: []cosmicswarm.TaskTool{
			{
				ToolDef: cosmicswarmLLM.ToolDef{
					Type: "function",
					Function: &cosmicswarmLLM.ToolFunctionDef{
						Name:        "store_image",
						Description: "Store the image in the database",
						Parameters: map[string]any{
							"type": "object",
							"properties": map[string]any{
								"image_url": map[string]any{
									"type":        "string",
									"description": "The url of the image to process",
								},
								"image_title": map[string]any{
									"type":        "string",
									"description": "The title of the image",
								},
								"image_context": map[string]any{
									"type":        "string",
									"description": "A summary of how the image relates to the content (1-10)",
								},
							},
						},
					},
				},
				Run: func(args map[string]any, taskExecutionContext *cosmicswarm.TaskExecutionContext) *cosmicswarm.TaskResult {
					urlString := args["image_url"].(string)
					title := args["image_title"].(string)
					context := args["image_context"].(string)

					noteID := taskExecutionContext.ContextVariables["note_id"].(int64)
					userID := taskExecutionContext.ContextVariables["user_id"].(string)

					openGraph := OpenGraph{
						URL:         urlString,
						Title:       title,
						Description: context,
						Image:       urlString,
					}

					_, err := insertResource(Resource{
						NoteID:    noteID,
						Type:      ResourceTypeImage,
						Source:    urlString,
						OpenGraph: openGraph,
						Metadata:  args,
						UserMeta:  make(map[ResourceMetadataKey]interface{}),
						CreatedAt: time.Now(),
						UserID:    userID,
					})
					if err != nil {
						return &cosmicswarm.TaskResult{
							Response: err.Error(),
							Error:    err,
						}
					}

					return &cosmicswarm.TaskResult{
						Response: fmt.Sprintf("Successfully processed resource from url: %s, title: %s, context: %s", urlString, title, context),
					}
				},
			},
		},
	})

	contextVariables := map[string]interface{}{
		"note_id": noteID,
		"user_id": userID,
	}

	err = taskManager.Execute(ctx, cosmicswarm.NewTaskExecutionContext([]cosmicswarmLLM.Message{
		{
			Role:    cosmicswarmLLM.RoleUser,
			Content: input,
		},
	}, contextVariables))
	if err != nil {
		return err
	}

	return nil
}

var summaryAgentSystemMessage = `
You are tasked with creating an objective summary of the provided content. Your goal is to distill the main ideas, key points, and practical applications from the given text. Follow these instructions carefully:

1. First, call the 'process_resource_from_url' function with the following parameters:
- url: The url of the article to get the content from

2. With the returned content, read and analyze the following content:

<content>
{{CONTENT}}
</content>

3. Create a summary with the following sections:

- Title: A concise, descriptive title for the content
- Summary: A brief overview of the main ideas (2-3 sentences)
- Key Points: 3-5 bullet points highlighting the most important information
- Takeaways: 2-3 main lessons or insights from the content
- Practical Applications: 3 ways this knowledge can be applied in real-world situations

4. Generate metadata for the summary:

- Title: The same title used in the summary
- Summary: A condensed version of the summary section (1-2 sentences)
- Tags: 3-5 relevant keywords or phrases
- Images: For each <img> tag (or image reference in markdown) in the content:
  - Extract the 'alt' attribute
  - Describe the image 

5. Analyze ALL links:
- You must analyze **ALL** the links in the content and provide a context for each link.
- You must include all links relevant to the content in the output.
- For each link, provide a brief explanation (1-2 sentences) of why it's relevant and how it relates to the main content

6. Identify follow-up links
- Identify a maximum of 3 links within the content that are extremely relevant to the main article and highlight them as follow-up links.

7. Analyze ALL images and provide context:

- you must analyze **ALL** the images in the content and provide a context for each image.
- For each image in the content:
  - Explain the concept illustrated in the image 
  - Provide context that links the image to the main article
  - Keep a reference to the image url in the output, like this: ![image description](image_url)

8. Format your output as follows:

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

## Follow-up Links

[Numbered list of links to follow up with explanations]


'''

For the metadata:
- title: [string]
- summary: [string]
- tags: [array of strings]
- image_analysis: [array of objects with 'alt' and 'description' properties]
- link_analysis: [array of objects with 'url' and 'relevance' properties]
- follow_up_links: [array of objects with 'url' and 'relevance' properties]

9. Important requirements:
- Use markdown format for the body content.
- Wrap key terms and concepts in double question marks, like this: ??[key term]??
- Key concepts and terms are things considered important to the content and that should be highlighted so the reader can easily follow the content.
- Do not include any text other than the markdown output.
- Do not enclose the output in '''markdown''' blocks.

10. After generating both the body and metadata, call the 'update_note' function with the following parameters:
- body: The full markdown output
- title: The title string
- summary: The summary string
- tags: The array of tag strings
- image_analysis: The array of image objects
- link_analysis: The array of link objects
- follow_up_links: The array of follow-up link objects

11. After calling the 'update_note' function, you must call the 'process_resource_from_url' function again for each of the follow-up links.
- url: The url of the follow-up link to process

12. Done.
`

// Your final output should only be the function call to 'update_note' with the generated information. Do not include any other text or explanations.

var updateNoteMetadataFn = cosmicswarm.TaskTool{
	ToolDef: cosmicswarmLLM.ToolDef{
		Type: "function",
		Function: &cosmicswarmLLM.ToolFunctionDef{
			Name:        "update_note_metadata",
			Description: "Update note (article summarization) with the generated metadata in the database.",
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
	Run: func(args map[string]any, taskExecutionContext *cosmicswarm.TaskExecutionContext) *cosmicswarm.TaskResult {
		noteId := taskExecutionContext.ContextVariables["note_id"].(int64)
		userID := taskExecutionContext.ContextVariables["user_id"].(string)
		note, err := GetNoteByID(noteId, userID)
		if err != nil {
			return &cosmicswarm.TaskResult{
				Response: err.Error(),
				Error:    err,
			}
		}

		var tags []string
		if args["tags"] != nil {
			tagsInterface := args["tags"].([]any)
			tags = make([]string, len(tagsInterface))
			for i, v := range tagsInterface {
				if v != nil {
					tags[i] = v.(string) //nolint:gosec
				}
			}
		}
		note.Tags = tags

		if args["summary"] != nil {
			note.Summary = args["summary"].(string)
		}
		if args["title"] != nil {
			note.Title = args["title"].(string) //nolint:gosec
		}

		err = UpdateNote(*note)
		if err != nil {
			return &cosmicswarm.TaskResult{
				Response: err.Error(),
				Error:    err,
			}
		}

		return &cosmicswarm.TaskResult{
			Response: fmt.Sprintf("Note metadata updated: <note_metadata>%s</note_metadata>", args),
		}
	},
}

var updateNoteBodyFn = cosmicswarm.TaskTool{
	ToolDef: cosmicswarmLLM.ToolDef{
		Type: "function",
		Function: &cosmicswarmLLM.ToolFunctionDef{
			Name:        "update_note_body",
			Description: "Update note (article summarization) with the generated body in the database.",
			Parameters: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"body": map[string]any{
						"type":        "string",
						"description": "The body of the article, the full generated output in markdown format",
					},
				},
			},
		},
	},
	Run: func(args map[string]any, taskExecutionContext *cosmicswarm.TaskExecutionContext) *cosmicswarm.TaskResult {
		noteId := taskExecutionContext.ContextVariables["note_id"].(int64)
		userID := taskExecutionContext.ContextVariables["user_id"].(string)
		note, err := GetNoteByID(noteId, userID)
		if err != nil {
			return &cosmicswarm.TaskResult{
				Response: err.Error(),
				Error:    err,
			}
		}

		if args["body"] != nil {
			note.Body = args["body"].(string) //nolint:gosec
		}

		err = UpdateNote(*note)
		if err != nil {
			return &cosmicswarm.TaskResult{
				Response: err.Error(),
				Error:    err,
			}
		}

		return &cosmicswarm.TaskResult{
			Response: note.Body,
		}
	},
}

// func (c *SummaryAgent) Run(context context.Context, prompt string, contextVariables map[string]interface{}, cosmicStreamHandler *CosmicStreamHandler) error {
// return nil
// 	summaryTaskManager, err := NewSummaryTaskManager(cosmicStreamHandler)
// 	if err != nil {
// 		return err
// 	}

// 	followUpTaskManager, err := NewFollowUpTaskManager(cosmicStreamHandler)
// 	if err != nil {
// 		return err
// 	}

// 	agentRegistry := map[string]cosmicswarm.TaskManager{
// 		"summary_agent":   *summaryTaskManager,
// 		"follow_up_agent": *followUpTaskManager,
// 	}

// 	cosmicTaskManager, err := cosmicswarm.NewTaskManager(config.GetConfig(config.OpenAIKey), cosmicswarmLLM.OpenAI, cosmicStreamHandler)
// 	if err != nil {
// 		return err
// 	}

// 	cosmicTaskManager.AddNewTask(&cosmicswarm.Task{
// 		ID: "meet_and_greet",
// 		Instructions: `
// 		You are Cosmic Dolphin, an AI assistant that helps users organize and understand their knowledge and get things done.
// 		You are given a prompt and you need to use your sub-agents to help the user.

// 		You have the ability to use the following sub-agents:
// 		- Summary Agent: Can fetch the contents of a link, summarize the given text and update the note in the database.
// 		- Chatter Agent: Can chat with the user and help them with their questions.
// 		- FollowUp Agent: Can add items to follow up on or get status updates on existing follow up items. Invoke this agent when the user uses the tag @fup.

// 		You can invoke any of the agents by calling the 'invoke_agent' function with the following parameters:
// 		- agent_name: The name of the agent to invoke. The name must be one of the following: summary_agent, chatter_agent, follow_up_agent
// 		- agent_instructions: The instructions for the agent to follow along with any additional parameter or context variable relevant to the task

// 		When the agent is done and returns a result, you must determine if the agent has completed the task the user asked for.
// 		If the agent has completed the task, you must return the result.
// 		If the agent has not completed the task, you must invoke the next agent.
// 		`,
// 		Functions: []cosmicswarm.AgentFunction{{
// 			Name:        "invoke_agent",
// 			Description: "Invoke the agent with the given name, instructions and parameters",
// 			Function: func(args map[string]interface{}, contextVariables map[string]interface{}) cosmicswarm.Result {
// 				agentName := args["agent_name"].(string)
// 				agentInstructions := args["agent_instructions"].(string)

// 				agentTaskManager, ok := agentRegistry[agentName]
// 				if !ok {
// 					return cosmicswarm.Result{
// 						Success: false,
// 						Data:    fmt.Sprintf("Agent %s not found", agentName),
// 					}
// 				}

// 				err := agentTaskManager.Execute(context, agentInstructions, contextVariables)
// 				if err != nil {
// 					return cosmicswarm.Result{
// 						Success: false,
// 						Data:    err.Error(),
// 					}
// 				}

// 				return cosmicswarm.Result{
// 					Success: true,
// 					Data:    fmt.Sprintf("Agent %s invoked", agentName),
// 				}
// 			},
// 			Parameters: map[string]any{
// 				"type": "object",
// 				"properties": map[string]any{
// 					"agent_name": map[string]any{
// 						"type":        "string",
// 						"description": "The name of the agent to invoke",
// 					},
// 					"agent_instructions": map[string]any{
// 						"type":        "string",
// 						"description": "The instructions for the agent to follow",
// 					},
// 					"agent_parameters": map[string]any{
// 						"type":        "object",
// 						"description": "The parameters for the agent to use",
// 					},
// 				},
// 			},
// 		}},
// 	})

// 	cosmicTaskManager.Execute(context, prompt, contextVariables)
// 	return nil
// }

// func NewSummaryTaskManager(cosmicStreamHandler *CosmicStreamHandler) (*cosmicswarm.TaskManager, error) {
// 	taskManager, err := cosmicswarm.NewTaskManager(config.GetConfig(config.OpenAIKey), cosmicswarmLLM.OpenAI, cosmicStreamHandler)
// 	if err != nil {
// 		return nil, err
// 	}

// 	taskManager.AddNewTask(&cosmicswarm.Task{
// 		ID: "process_resource_from_url",
// 		Instructions: `
// 		Call the 'process_resource_from_url' function with the following parameters:
// 			- url: The url of the article to get the content from
// 		`,
// 		Functions: []cosmicswarm.AgentFunction{{
// 			Name:        "process_resource_from_url",
// 			Description: "Process the resource from the url and return the content",
// 			Function: func(args map[string]interface{}, contextVariables map[string]interface{}) cosmicswarm.Result {
// 				url := args["url"].(string)
// 				noteID := contextVariables["note_id"].(int64)
// 				userID := contextVariables["user_id"].(string)

// 				_, textContent, err := ProcessResource(noteID, userID, url)
// 				if err != nil {
// 					return cosmicswarm.Result{
// 						Success: false,
// 						Data:    err.Error(),
// 					}
// 				}

// 				return cosmicswarm.Result{
// 					Success: true,
// 					Variables: map[string]interface{}{
// 						"content": string(textContent),
// 					},
// 				}
// 			},
// 			Parameters: map[string]any{
// 				"type": "object",
// 				"properties": map[string]any{
// 					"url": map[string]any{
// 						"type":        "string",
// 						"description": "The url of the article to get the content from",
// 					},
// 				},
// 			},
// 		}},
// 	})

// 	taskManager.AddNewTask(&cosmicswarm.Task{
// 		ID: "read_content_and_generate_metadata",
// 		Instructions: `
// 		Your task is to generate the metadata for the content. Follow the instructions below step by step:

// 		1. Read and analyze the following content:
// 		<content>
// 		{{CONTENT}}
// 		</content>

// 		2. Generate the following metadata for the content:
// 		- Title: The same title used in the summary
// 		- Summary: A condensed version of the summary section (1-2 sentences)
// 		- Tags: 3-5 relevant keywords or phrases
// 		- Links: For each link in the content execute an analysis like described in step 3.
// 		- Images: For each <img> tag (or image reference in markdown) in the content execute an analysis like described in step 4.

// 		3. Analyze ALL links:
// 		- You must analyze **ALL** the links in the content and provide a context for each link.
// 		- You must include all links relevant to the content in the output.
// 		- For each link, provide a brief explanation (1-2 sentences) of why it's relevant and how it relates to the main content

// 		4. Analyze ALL images and provide context:
// 		- you must analyze **ALL** the images in the content and provide a context for each image.
// 		- For each image in the content:
// 		- Explain the concept illustrated in the image
// 		- Provide context that links the image to the main article
// 		- Keep a reference to the image url in the output, like this: ![image description](image_url)

// 		5. Format the output as follows:
// 		You must ouput a json object with the following properties:
// 			- title: [string]
// 			- summary: [string]
// 			- tags: [array of strings]
// 			- link_analysis: [array of objects with 'url' and 'relevance' properties]
// 			- image_analysis: [array of objects with 'alt' and 'description' properties]

// 		6. Call the 'update_note' function with the following parameters:
// 		- metadata:	the json object with the metadata
// 			- title: The title string
// 			- summary: The summary string
// 			- tags: The array of tag strings
// 			- image_analysis: The array of image objects
// 			- link_analysis: The array of link objects
// 		`,
// 		Functions: []cosmicswarm.AgentFunction{updateNoteMetadataFn},
// 	})

// 	taskManager.AddTask(&cosmicswarm.Task{
// 		ID: "read_content_and_summarize",
// 		Instructions: `
// Your task is to generate the summary for the content. Follow the instructions below step by step:

// 1. Read and analyze the following content:

// <content>
// {{CONTENT}}
// </content>

// 2. Create a summary with the following sections:

// - Title: A concise, descriptive title for the content
// - Summary: A brief overview of the main ideas (2-3 sentences)
// - Key Points: 3-5 bullet points highlighting the most important information
// - Takeaways: 2-3 main lessons or insights from the content
// - Practical Applications: 3 ways this knowledge can be applied in real-world situations
// - Identify follow-up links: Identify a maximum of 3 links within the content that are extremely relevant to the main article and highlight them as follow-up links.

// 3. Format the output as follows:
// Your output must be a JSON object with the following properties:
// 	- body: The complete summary in markdown format (without the '''markdown''' blocks), like this:

// 	'''markdown
// 	## [Title]

// 	[Summary]

// 	## Key Points

// 	[Bullet points]

// 	## Takeaways

// 	[Bullet points]

// 	## Practical Applications

// 	[Numbered list]

// 	## Follow-up Links

// 	[Numbered list of links to follow up with explanations]
// 	'''

// 4. Call the 'update_note' function with the following parameters:
// A Json object with the following properties:
// 	- body: The complete summary in markdown format

// ## Important requirements:
// - Use markdown format for the body content.
// - Wrap key terms and concepts in double question marks, like this: ??[key term]??
// - Key concepts and terms are things considered important to the content and that should be highlighted so the reader can easily follow the content.
// - Do not include any text other than the markdown output.
// - Do not enclose the output in '''markdown''' blocks.

// 		`,
// 		Functions: []cosmicswarm.AgentFunction{updateNoteBodyFn},
// 	})

// 	taskManager.AddTask(&cosmicswarm.Task{
// 		ID:           "process_follow_up_links",
// 		Instructions: `You must call the 'process_resource_from_url' function for each of the follow-up links.`,
// 		Tools: []cosmicswarm.TaskTool{
// 			{
// 				ToolDef: llm.ToolDef{
// 					Type: "function",
// 					Function: &llm.ToolFunctionDef{
// 						Name:        "process_resource_from_url",
// 						Description: "Process the resource from the url and return the content",
// 						Parameters: map[string]any{
// 							"type": "object",
// 							"properties": map[string]any{
// 								"url": {
// 									"type":        "string",
// 									"description": "The url of the article to get the content from",
// 								},
// 							},
// 						},
// 					},
// 				},
// 				Run: func(task *cosmicswarm.Task, taskExecutionContext *cosmicswarm.TaskExecutionContext) (*cosmicswarm.TaskResult, error) {
// 					url := args["url"].(string)
// 					noteID := contextVariables["note_id"].(int64)
// 					userID := contextVariables["user_id"].(string)

// 					_, textContent, err := ProcessResource(noteID, userID, url)
// 					if err != nil {
// 						return cosmicswarm.Result{
// 							Success: false,
// 							Data:    err.Error(),
// 						}
// 					}

// 					return cosmicswarm.Result{
// 						Success: true,
// 						Data:    fmt.Sprintf("<content>%s</content>", string(textContent)),
// 					}
// 				},
// 			}},
// 	})

// 	taskManager.AddTask(&cosmicswarm.Task{
// 		ID: "determine_relevant_images",
// 		InstructionsFn: func(task *cosmicswarm.Task, contextVariables map[string]interface{}) string {

// 			return `
// 		You must determine the images that relate to the content and are relevant to the content.
// 		You must skip images that are not relevant to the content such as logos, icons, avatars, advertisements, etc.
// 		You must call the 'process_image' function for each of the images that are relevant to the content.
// 		For each image you must gather the following information:
// 		- image_url: The url of the image
// 		- image_description: The description of the image
// 		- image_relevance: The relevance of the image to the content (1-10)
// 		- image_context: Explanation of how the image is connected to the content. Read the content to understand the reference to the image. The context must be a summary of the image and how it relates to the content. You must deterime how this image is used to illustrate the content.

// 		You must call the 'process_image' function for each of the images that are relevant to the content with the following parameters:
// 		- image_url: The url of the image
// 		- image_description: The description of the image
// 		- image_relevance: The relevance of the image to the content (1-10)
// 		- image_context: Explanation of how the image is connected to the content. Read the content to understand the reference to the image. The context must be a summary of the image and how it relates to the content. You must deterime how this image is used to illustrate the content.
// 		`
// 		},
// 		Functions: []cosmicswarm.AgentFunction{
// 			{
// 				Name:        "process_image",
// 				Description: "Process the image and return the content",
// 				TaskFunction: func(task *cosmicswarm.Task, args map[string]interface{}, contextVariables map[string]interface{}) cosmicswarm.Result {
// 					// noteID := contextVariables["note_id"].(int64)
// 					// userID := contextVariables["user_id"].(string)
// 					imageUrl := args["image_url"].(string)
// 					imageDescription := args["image_description"].(string)
// 					imageRelevance := args["image_relevance"].(float64)
// 					imageContext := args["image_context"].(string)

// 					// download the image from the url
// 					imageData, err := http.Get(imageUrl)
// 					if err != nil {
// 						return cosmicswarm.Result{
// 							Success: false,
// 							Data:    err.Error(),
// 						}
// 					}
// 					defer imageData.Body.Close()

// 					// read the image data
// 					imageDataBytes, err := io.ReadAll(imageData.Body)
// 					if err != nil {
// 						return cosmicswarm.Result{
// 							Success: false,
// 							Data:    err.Error(),
// 						}
// 					}
// 					// encode the image to base64 string
// 					imageDataBase64 := base64.StdEncoding.EncodeToString(imageDataBytes)

// 					// create a new context variables map
// 					newContextVariables := make(map[string]interface{})
// 					newContextVariables["image_data"] = imageDataBase64
// 					newContextVariables["image_url"] = imageUrl
// 					newContextVariables["image_description"] = imageDescription
// 					newContextVariables["image_relevance"] = imageRelevance
// 					newContextVariables["image_context"] = imageContext

// 					task.AddSubTask(&cosmicswarm.Task{
// 						ID:           "describe_image",
// 						Instructions: `Describe the image in detail.`,
// 						Context:      newContextVariables,
// 					})

// 					task.AddSubTask(&cosmicswarm.Task{
// 						ID:           "save_image",
// 						Instructions: `Save the image to the database.`,
// 					})

// 					return cosmicswarm.Result{
// 						Success: true,
// 						Data:    fmt.Sprintf("Image processed: %s with description: %s, relevance: %f, context: %s", imageUrl, imageDescription, imageRelevance, imageContext),
// 					}
// 				},
// 				Parameters: map[string]any{
// 					"type": "object",
// 					"properties": map[string]any{
// 						"image_url": map[string]any{
// 							"type":        "string",
// 							"description": "The url of the image to process",
// 						},
// 						"image_description": map[string]any{
// 							"type":        "string",
// 							"description": "The description of the image (if any)",
// 						},
// 						"image_relevance": map[string]any{
// 							"type":        "number",
// 							"description": "The relevance of the image to the content (1-10)",
// 						},
// 						"image_context": map[string]any{
// 							"type":        "string",
// 							"description": "A summary of how the image relates to the content (1-10)",
// 						},
// 					},
// 				},
// 			},
// 		},
// 	})

// 	return taskManager, nil

// }

func NewFollowUpTaskManager(cosmicStreamHandler *CosmicStreamHandler) (*cosmicswarm.TaskManager, error) {
	return nil, nil

	// taskManager, err := cosmicswarm.NewTaskManager(config.GetConfig(config.OpenAIKey), cosmicswarmLLM.OpenAI, cosmicStreamHandler)
	// if err != nil {
	// 	return nil, err
	// }

	// taskManager.AddTask(&cosmicswarm.Task{
	// 	ID: "follow_up_agent",
	// 	Instructions: `
	// 	You are the follow-up agent that helps the user to keep track of items he wants to get done with people from his team.
	// 	There are two types of tasks the user can ask you:
	// 	- Add a follow-up item to the follow-up heap
	// 	- Get an status update on the follow-up items from the follow-up heap

	// 	### Add a follow-up item to the follow-up heap
	// 	You are given a topic and a recurrence to follow up on.
	// 	You must add the follow-up item to the follow-up heap by calling the 'add_follow_up_item' function with the following parameters:
	// 	- topic: The topic to follow up on
	// 	- recurrence: The recurrence to follow up on

	// 	### Get an status update on the follow-up items from the follow-up heap
	// 	You are asked about the status of the follow-up items in the follow-up heap.
	// 	You must call the 'get_follow_up_items' function with the following parameters:
	// 	- topic: The topic to follow up on

	// 	You must return the status of the follow-up items in the follow-up heap.

	// 	### Important requirements:
	// 	- You must call the 'add_follow_up_item' function to add a follow-up item to the follow-up heap.
	// 	- You must call the 'get_follow_up_items' function to get an status update on the follow-up items from the follow-up heap.
	// 	`,
	// 	Functions: []cosmicswarm.AgentFunction{
	// 		{
	// 			Name:        "add_follow_up_item",
	// 			Description: "Add a follow-up item to the follow-up heap",
	// 			Function: func(args map[string]interface{}, contextVariables map[string]interface{}) cosmicswarm.Result {
	// 				topic := args["topic"].(string)
	// 				recurrence := args["recurrence"].(string)

	// 				return cosmicswarm.Result{
	// 					Success: true,
	// 					Data:    fmt.Sprintf("Follow-up item added to the follow-up heap: %s with recurrence: %s", topic, recurrence),
	// 				}
	// 			},
	// 			Parameters: map[string]any{
	// 				"type": "object",
	// 				"properties": map[string]any{
	// 					"topic": map[string]any{
	// 						"type":        "string",
	// 						"description": "The topic to follow up on",
	// 					},
	// 					"recurrence": map[string]any{
	// 						"type":        "string",
	// 						"description": "The recurrence to follow up on",
	// 					},
	// 				},
	// 			},
	// 		},
	// 		{
	// 			Name:        "get_follow_up_items",
	// 			Description: "Get the follow-up items from the follow-up heap",
	// 			Function: func(args map[string]interface{}, contextVariables map[string]interface{}) cosmicswarm.Result {
	// 				topic := args["topic"].(string)
	// 				return cosmicswarm.Result{
	// 					Success: true,
	// 					Data:    fmt.Sprintf("Here's the status update for the follow-up items: %v", topic),
	// 				}
	// 			},
	// 			Parameters: map[string]any{
	// 				"type": "object",
	// 				"properties": map[string]any{
	// 					"topic": map[string]any{
	// 						"type":        "string",
	// 						"description": "The topic to follow up on",
	// 					},
	// 				},
	// 			},
	// 		},
	// 	},
	// })

	// return taskManager, nil
}
