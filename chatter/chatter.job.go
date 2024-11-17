package chatter

import (
	"context"
	"cosmic-dolphin/config"
	"cosmic-dolphin/job"
	"cosmic-dolphin/llm/agents"
	"cosmic-dolphin/llm/client/openai"
	"cosmic-dolphin/notes"

	"github.com/riverqueue/river"
	"github.com/sirupsen/logrus"
)

type ChatterJobWorker struct {
	river.WorkerDefaults[job.ChatterJobArgs]
}

func (w *ChatterJobWorker) Work(ctx context.Context, job *river.Job[job.ChatterJobArgs]) error {
	logrus.WithFields(logrus.Fields{"note.id": job.Args.NoteID}).Info("Chatter working on note")

	client := openai.New(config.GetConfig(config.OpenAIKey))
	chatterAgent := agents.NewChatterAgent(client)

	note, err := notes.GetNoteByID(job.Args.NoteID, job.Args.UserID)
	if err != nil {
		return err
	}

	chatterResponse, err := chatterAgent.Run(ctx, job.Args.Input)
	if err != nil {
		return err
	}

	note.Sections = append(note.Sections, notes.NewTextSection("Revised Text", chatterResponse.Text))
	note.Title = chatterResponse.Title
	notes.UpdateNote(*note)

	return nil

}
