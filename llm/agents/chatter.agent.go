package agents

import (
	"context"
	"cosmic-dolphin/llm/client"
	"encoding/json"
	"fmt"

	"github.com/invopop/jsonschema"
)

type ChatterResponse struct {
	Title string `json:"title"`
	Text  string `json:"text"`
}

type ChatterAgent struct {
	BaseAgent
}

func NewChatterAgent(client client.Client) *ChatterAgent {

	role := `Expert in Communication`
	background := `A highly skilled professional dedicated to ensuring communication is grammatically precise, assertive, clear, 
	and concise across various channels and contexts. 
	This individual bridges the gap between technical language expertise and effective interpersonal communication techniques to foster
	understanding, collaboration, and impact.
	Experience in content creation, editing, and cross-cultural communication.
	Proficient in distilling complex information into easily digestible, straightforward messaging.
	Expertise in avoiding ambiguity and ensuring the purpose of communication is immediately clear.
	Ability to convey ideas and feedback confidently and respectfully, promoting clarity without aggression.
	Ability to tailor writing style and tone to the audience and context, whether formal, persuasive, or conversational.
	Mastery of grammar, syntax, and language rules to ensure error-free and professional communication.
	Proficiency in conflict resolution and facilitating difficult conversations with tact and diplomacy.
	You communicate with authority and assertiveness, ensuring that your message is clear and impactful.
	You use a light and friendly tone and always sound natural.
	`

	goal := `
	Crafting and reviewing internal and external communications, ensuring linguistic accuracy and message clarity.
	`

	baseAgent := NewBaseAgent(client, role, background, goal)

	chatterAgent := ChatterAgent{
		BaseAgent: baseAgent,
	}

	return &chatterAgent
}

func (s *ChatterAgent) Run(ctx context.Context, input string) (ChatterResponse, error) {
	jsonschemaReflector := &jsonschema.Reflector{}
	jsonschemaReflector.ExpandedStruct = true

	s.BaseAgent.ResponseFormat = &client.ResponseFormat{
		Schema: jsonschemaReflector.Reflect(&ChatterResponse{}),
	}

	s.AddTask(fmt.Sprintf(`
		Given a text message enclosed by <content></content> tags, review it and rewrite it in a more concise and clear manner.
		Also generate a title that explains the main idea.

		<content>
		%s
		</content>
		`, input))

	res, err := s.BaseAgent.Run(ctx, input)
	if err != nil {
		return ChatterResponse{}, err
	}

	var chatterResponse ChatterResponse
	err = json.Unmarshal([]byte(res), &chatterResponse)
	if err != nil {
		return ChatterResponse{}, err
	}

	return chatterResponse, nil
}
