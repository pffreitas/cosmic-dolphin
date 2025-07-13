package agents

import (
	"context"
	"cosmic-dolphin/config"
	"cosmic-dolphin/llm"
	"fmt"

	"github.com/allurisravanth/swarmgo"
	swarmLlm "github.com/allurisravanth/swarmgo/llm"
	"github.com/sirupsen/logrus"
)

type CustomStreamHandler struct {
	responseChan chan<- llm.LLMToken
}

func (h *CustomStreamHandler) OnStart() {
	// No action needed on start
}

func (h *CustomStreamHandler) OnToken(token string) {
	h.responseChan <- llm.LLMToken{
		Data: token,
		Done: false,
	}
}

func (h *CustomStreamHandler) OnError(err error) {
	h.responseChan <- llm.LLMToken{
		Data: err.Error(),
		Done: true,
	}
}

func (h *CustomStreamHandler) OnComplete(message swarmLlm.Message) {
	h.responseChan <- llm.LLMToken{
		Done: true,
	}
}

func (h *CustomStreamHandler) OnToolCall(toolCall swarmLlm.ToolCall) {
	h.responseChan <- llm.LLMToken{
		Data: "",
		Done: false,
	}
}

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

func RunSummaryAgent(input string, responseChan chan<- llm.LLMToken) (Summary, error) {

	// jsonschemaReflector := &jsonschema.Reflector{}
	// jsonschemaReflector.ExpandedStruct = true

	// s.BaseAgent.ResponseFormat = &client.ResponseFormat{
	// 	Schema: jsonschemaReflector.Reflect(&Summary{}),
	// }

	systemMessage := `Techinical Writer - Software Enginnering; Enterprise Applications; Modern App Development.
	In an increasingly information-rich environment, individuals and organizations need quick, efficient ways to process and comprehend vast amounts of written content. From research papers to industry articles and internal documentation, valuable insights can easily be lost in the sheer volume of material. Traditional methods of skimming or summarizing are time-intensive and often overlook critical points or key themes. To address this challenge, an AI-driven Content Summarization Agent can provide an intelligent solution by autonomously analyzing and distilling complex texts. By identifying key takeaways, essential points, concise summaries, and relevant tags, this Agent enables users to access and organize information more effectively, making it possible to stay informed and make faster, more data-driven decisions."
	The goal of the AI Content Summarization Agent is to empower users with rapid access to essential information by providing accurate, concise, and contextually relevant summaries. By automating the extraction of key takeaways, main points, and appropriate tags from a variety of content formats, the Agent enhances information accessibility, streamlines content discovery, and supports data-informed decision-making. Ultimately, this tool aims to reduce time spent on content analysis, improve organizational efficiency, and facilitate knowledge sharing across teams and domains."
`

	message := fmt.Sprintf(`
		given content enclosed by <content></content> tags, help me extract:
		- key points
		- take aways
		- 3 practical applications of this knowledge 
		- a title
		- a one paragraph summary
		- tags (array of strings)

		for the images, when you find a <img> tag:
		- extract the 'alt' attribute
		- describe the image in a sentence
		- incorporate the description of the image in the analisys of the text

		output in parseable json format folowing the structure:
		{
			"key-points": [""], 
			"take-aways": [""], 
			"applications": [""], 
			"title": "", 
			"summary": "", 
			"tags": [""],
			"images": [
				{ "alt": "", "description": "" }
			]
		}

		### Article
		<content>
		%s
		</content>
		`, input)

	logrus.Info(">>>>>>>> Running summary agent")

	swarmClient := swarmgo.NewSwarm(config.GetConfig(config.OpenAIKey), swarmLlm.OpenAI)
	agent := &swarmgo.Agent{
		Name:         "Agent",
		Instructions: systemMessage,
		Model:        "gpt-4.1-mini-2025-04-14",
	}

	messages := []swarmLlm.Message{
		{Role: "user", Content: message},
	}

	handler := &CustomStreamHandler{
		responseChan: responseChan,
	}

	err := swarmClient.StreamingResponse(
		context.Background(),
		agent,
		messages,
		nil,
		"",
		handler,
		true,
	)

	if err != nil {
		return Summary{}, err
	}

	// var summary Summary
	// err = json.Unmarshal([]byte(res), &summary)
	// if err != nil {
	// 	return Summary{}, err
	// }

	return Summary{}, nil
}
