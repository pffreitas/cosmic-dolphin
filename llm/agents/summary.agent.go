package agents

import (
	"context"
	"cosmic-dolphin/llm/client"
	"encoding/json"
	"fmt"

	"github.com/invopop/jsonschema"
)

type Summary struct {
	KeyPoints    []string `json:"key-points"`
	TakeAways    []string `json:"take-aways"`
	Applications []string `json:"applications"`
	Title        string   `json:"title"`
	Summary      string   `json:"summary"`
	Tags         string   `json:"tags"`
	Images       []struct {
		Alt        string `json:"alt"`
		Descrption string `json:"description"`
	} `json:"images"`
}

type SummaryAgent struct {
	BaseAgent
}

func NewSummaryAgent(client client.Client) *SummaryAgent {
	role := `Techinical Writer - Software Enginnering; Enterprise Applications; Modern App Development`
	background := "In an increasingly information-rich environment, individuals and organizations need quick, efficient ways to process and comprehend vast amounts of written content. From research papers to industry articles and internal documentation, valuable insights can easily be lost in the sheer volume of material. Traditional methods of skimming or summarizing are time-intensive and often overlook critical points or key themes. To address this challenge, an AI-driven Content Summarization Agent can provide an intelligent solution by autonomously analyzing and distilling complex texts. By identifying key takeaways, essential points, concise summaries, and relevant tags, this Agent enables users to access and organize information more effectively, making it possible to stay informed and make faster, more data-driven decisions."
	goal := "The goal of the AI Content Summarization Agent is to empower users with rapid access to essential information by providing accurate, concise, and contextually relevant summaries. By automating the extraction of key takeaways, main points, and appropriate tags from a variety of content formats, the Agent enhances information accessibility, streamlines content discovery, and supports data-informed decision-making. Ultimately, this tool aims to reduce time spent on content analysis, improve organizational efficiency, and facilitate knowledge sharing across teams and domains."

	baseAgent := NewBaseAgent(client, role, background, goal)

	summaryAgent := SummaryAgent{
		BaseAgent: baseAgent,
	}

	return &summaryAgent
}

func (s *SummaryAgent) Run(ctx context.Context, input string) (Summary, error) {

	jsonschemaReflector := &jsonschema.Reflector{}
	jsonschemaReflector.ExpandedStruct = true

	s.BaseAgent.ResponseFormat = client.ResponseFormat{
		Schema: jsonschemaReflector.Reflect(&Summary{}),
	}

	s.AddTask(fmt.Sprintf(`
		given content enclosed by <content></content> tags, help me extract:
		- key points
		- take aways
		- 3 practical applications of this knowledge 
		- a title
		- a one paragraph summary
		- tags 

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
			"tags": "",
			"images": [
				{ "alt": "", "description": "" }
			]
		}

		### Article
		<content>
		%s
		</content>
		`, input))

	res, err := s.BaseAgent.Run(ctx, input)
	if err != nil {
		return Summary{}, err
	}

	var summary Summary
	err = json.Unmarshal([]byte(res), &summary)
	if err != nil {
		return Summary{}, err
	}

	return summary, nil
}
