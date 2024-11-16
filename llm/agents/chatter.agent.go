package agents

import (
	"context"
	"cosmic-dolphin/llm/client"
	"fmt"
)

type ChatterAgent struct {
	BaseAgent
}

func NewChatterAgent(client client.Client) *ChatterAgent {
	role := `Expert in Communication, Communication Specialist, Strategic Communication Expert`
	background := `A highly skilled professional dedicated to ensuring communication is grammatically precise, assertive, clear, 
	and concise across various channels and contexts. 
	This individual bridges the gap between technical language expertise and effective interpersonal communication techniques to foster
	understanding, collaboration, and impact.
	Expertise in linguistics, journalism, or a related field.
	Experience in content creation, editing, and cross-cultural communication.
	Proficient in distilling complex information into easily digestible, straightforward messaging.
	Expertise in avoiding ambiguity and ensuring the purpose of communication is immediately clear.
	Ability to convey ideas and feedback confidently and respectfully, promoting clarity without aggression.
	Ability to tailor writing style and tone to the audience and context, whether formal, persuasive, or conversational.
	Mastery of grammar, syntax, and language rules to ensure error-free and professional communication.
	Proficiency in conflict resolution and facilitating difficult conversations with tact and diplomacy.
	`

	goal := `
	Crafting and reviewing internal and external communications, ensuring linguistic accuracy and message clarity.
	`

	baseAgent := NewBaseAgent(client, role, background, goal)

	chatterAgent := ChatterAgent{
		BaseAgent: baseAgent,
	}

	fmt.Println(">>>> Chatter Agent created", chatterAgent.ResponseFormat)

	return &chatterAgent
}

func (s *ChatterAgent) Run(ctx context.Context, input string) (string, error) {

	s.AddTask(fmt.Sprintf(`
		Given a text message enclosed by <content></content> tags, review it and rewrite it in a more concise and clear manner.
		Ensure that the rewritten text is grammatically correct and maintains the original meaning.
		Polish the text to sound assertive, natural, and professional. Use a light and friendly tone. 
		Use authority and assertiveness in the communication.
		Make sure it is natural and clear.

		<content>
		%s
		</content>
		`, input))

	text, err := s.BaseAgent.Run(ctx, input)
	if err != nil {
		return "", err
	}

	return text, nil
}
