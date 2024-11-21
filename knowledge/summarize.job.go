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

	resource, err := fetchResourceByDocumentID(*doc.ID)
	if err != nil {
		return err
	}

	note, err := notes.GetNoteByID(resource.NoteID, resource.UserID)
	if err != nil {
		return err
	}

	summary, err := summarize(ctx, *doc)
	if err != nil {
		return err
	}

	sections := []notes.NoteSection{}
	sections = append(sections, notes.NewTextSection("Key Points", strings.Join(summary.KeyPoints, "\n")))
	sections = append(sections, notes.NewTextSection("Take Aways", strings.Join(summary.TakeAways, "\n")))
	sections = append(sections, notes.NewTextSection("Applications", strings.Join(summary.Applications, "\n")))

	note.DocumentID = &job.Args.DocumentID
	note.Title = summary.Title
	note.Summary = summary.Summary
	note.Tags = summary.Tags
	note.Sections = sections

	err = notes.UpdateNote(*note)
	if err != nil {
		return err
	}

	return nil
}

func summarize(ctx context.Context, doc Document) (*agents.Summary, error) {
	client := openai.New(config.GetConfig(config.OpenAIKey))
	summaryAgent := agents.NewSummaryAgent(client)

	summary, err := summaryAgent.Run(ctx, doc.Content)
	if err != nil {
		return nil, err
	}

	return &summary, nil
}
