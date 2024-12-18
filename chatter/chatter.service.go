package chatter

import (
	"context"
	"cosmic-dolphin/config"
	"cosmic-dolphin/llm/agents"
	"cosmic-dolphin/llm/client/openai"
	"cosmic-dolphin/notes"

	"github.com/sirupsen/logrus"
)

func Init() {
	notes.AddNotesProcessor(ChatterNoteProcessor{})
}

type ChatterNoteProcessor struct{}

func (p ChatterNoteProcessor) ProcessNote(noteID int64, userID string) error {
	note, err := notes.GetNoteByID(noteID, userID)
	if err != nil {
		return err
	}

	if note.Type != notes.NoteTypeChatter {
		return nil
	}

	err = foo(note)
	if err != nil {
		logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to insert chatter job")
		return err
	}

	return nil
}

func foo(note *notes.Note) error {
	client := openai.New(config.GetConfig(config.OpenAIKey))
	chatterAgent := agents.NewChatterAgent(client)

	chatterResponse, err := chatterAgent.Run(context.Background(), note.RawBody)
	if err != nil {
		return err
	}

	note.Sections = append(note.Sections, notes.NewTextSection("Revised Text", chatterResponse.Text))
	note.Title = chatterResponse.Title
	notes.UpdateNote(*note)

	return nil
}
