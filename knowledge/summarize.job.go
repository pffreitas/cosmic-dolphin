package knowledge

import (
	"context"
	"cosmic-dolphin/config"
	"cosmic-dolphin/llm/agents"
	"cosmic-dolphin/llm/client/openai"
	"cosmic-dolphin/notes"
	"strings"

	"github.com/riverqueue/river"
	"github.com/sirupsen/logrus"
)

type SummarizeJobArgs struct {
	DocumentID int64
}

func (SummarizeJobArgs) Kind() string { return "Summarize" }

type SummarizeJobWorker struct {
	river.WorkerDefaults[SummarizeJobArgs]
}

func (w *SummarizeJobWorker) Work(ctx context.Context, job *river.Job[SummarizeJobArgs]) error {
	log.WithFields(logrus.Fields{"document.id": job.Args.DocumentID}).Info("Summarizing document")

	doc, err := fetchDocumentByID(job.Args.DocumentID)
	if err != nil {
		return err
	}

	client := openai.New(config.GetConfig(config.OpenAIKey))
	summaryAgent := agents.NewSummaryAgent(client)

	summary, err := summaryAgent.Run(ctx, doc.Content)
	if err != nil {
		return err
	}

	sections := []notes.NoteSection{}
	sections = append(sections, notes.NewTextSection("Key Points", strings.Join(summary.KeyPoints, "\n")))
	sections = append(sections, notes.NewTextSection("Take Aways", strings.Join(summary.TakeAways, "\n")))
	sections = append(sections, notes.NewTextSection("Applications", strings.Join(summary.Applications, "\n")))

	_, err = notes.InsertNote(notes.Note{
		DocumentID: &job.Args.DocumentID,
		Title:      summary.Title,
		Summary:    summary.Summary,
		Tags:       summary.Tags,
		Sections:   sections,
		UserID:     doc.UserID,
	})

	if err != nil {
		return err
	}

	return nil
}
