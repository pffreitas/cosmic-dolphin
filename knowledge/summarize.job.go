package knowledge

import (
	"cosmic-dolphin/llm"
	"cosmic-dolphin/llm/agents"
	"cosmic-dolphin/notes"
	"strings"

	"github.com/sirupsen/logrus"
)

func sumarize(documentID int64, responseChan chan<- llm.LLMToken) error {
	log.WithFields(logrus.Fields{"document.id": documentID}).Info("Summarizing document")

	doc, err := fetchDocumentByID(documentID)
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

	summary, err := summarizeDocument(*doc, responseChan)
	if err != nil {
		return err
	}

	sections := []notes.NoteSection{}
	sections = append(sections, notes.NewTextSection("Key Points", strings.Join(summary.KeyPoints, "\n")))
	sections = append(sections, notes.NewTextSection("Take Aways", strings.Join(summary.TakeAways, "\n")))
	sections = append(sections, notes.NewTextSection("Applications", strings.Join(summary.Applications, "\n")))

	note.DocumentID = &documentID
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

func summarizeDocument(doc Document, responseChan chan<- llm.LLMToken) (*agents.Summary, error) {

	summary, err := agents.RunSummaryAgent(doc.Content, responseChan)
	if err != nil {
		return nil, err
	}

	return &summary, nil
}
