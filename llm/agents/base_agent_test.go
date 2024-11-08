package agents_test

import (
	"cosmic-dolphin/config"
	"testing"
)

func TestBaseAgent(t *testing.T) {
	config.LoadEnv("../../.dev.env")

	t.Run("Test Base Agent", func(t *testing.T) {
		// client := openai.New(config.GetConfig(config.OpenAIKey))

		// role := `Techinical Writer - Software Enginnering; Enterprise Applications; Modern App Development`
		// background := "In an increasingly information-rich environment, individuals and organizations need quick, efficient ways to process and comprehend vast amounts of written content. From research papers to industry articles and internal documentation, valuable insights can easily be lost in the sheer volume of material. Traditional methods of skimming or summarizing are time-intensive and often overlook critical points or key themes. To address this challenge, an AI-driven Content Summarization Agent can provide an intelligent solution by autonomously analyzing and distilling complex texts. By identifying key takeaways, essential points, concise summaries, and relevant tags, this Agent enables users to access and organize information more effectively, making it possible to stay informed and make faster, more data-driven decisions."
		// goal := "The goal of the AI Content Summarization Agent is to empower users with rapid access to essential information by providing accurate, concise, and contextually relevant summaries. By automating the extraction of key takeaways, main points, and appropriate tags from a variety of content formats, the Agent enhances information accessibility, streamlines content discovery, and supports data-informed decision-making. Ultimately, this tool aims to reduce time spent on content analysis, improve organizational efficiency, and facilitate knowledge sharing across teams and domains."

		// baseAgent := agents.NewBaseAgent(client, role, background, goal)

		// res, err := baseAgent.Run(context.Background(), "")

		// if err != nil {
		// 	t.Errorf("Error: %v", err)
		// }

		// t.Logf("Response: %v", res)
	})
}
