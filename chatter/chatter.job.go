package chatter

import (
	"context"
	"cosmic-dolphin/config"
	"cosmic-dolphin/knowledge"
	"cosmic-dolphin/llm/agents"
	"cosmic-dolphin/llm/client/openai"

	"github.com/riverqueue/river"
	"github.com/sirupsen/logrus"
)

type ChatterJobArgs struct {
	NoteID int64
	UserID string
	Input  string
}

func (ChatterJobArgs) Kind() string { return "ChatterJob" }

type ChatterJobWorker struct {
	river.WorkerDefaults[ChatterJobArgs]
}

func (w *ChatterJobWorker) Work(ctx context.Context, job *river.Job[ChatterJobArgs]) error {
	logrus.WithFields(logrus.Fields{"note.id": job.Args.NoteID}).Info("Chatter working on note")

	client := openai.New(config.GetConfig(config.OpenAIKey))
	chatterAgent := agents.NewChatterAgent(client)

	note, err := knowledge.GetNoteByID(job.Args.NoteID, job.Args.UserID)
	if err != nil {
		return err
	}

	text, err := chatterAgent.Run(ctx, note.Title)
	if err != nil {
		return err
	}

	note.Sections = append(note.Sections, knowledge.NewTextSection("chatter", text))
	// update note

	return nil

}
