package knowledge

import (
	"context"
	"cosmic-dolphin/llm"
	"cosmic-dolphin/notes"
	"strings"
	"time"
)

type KnowledgeResponse struct {
	Event  string `json:"event"`
	Data   string `json:"data"`
	NoteID *int64 `json:"note_id,omitempty"`
	Done   bool   `json:"done"`
}

func runKnowledgePipelineAndStream(ctx context.Context, userID string, rawURL string, noteID int64, responseChan chan<- llm.LLMToken) error {
	defer close(responseChan)

	// Create note
	note, err := notes.GetNoteByID(noteID, userID)
	if err != nil {
		responseChan <- llm.LLMToken{Event: "error", Data: err.Error(), Done: true}
		return err
	}

	// Check for cancellation
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	// Create resource
	persistedResource, err := insertResource(Resource{
		NoteID:    *note.ID,
		Type:      ResourceTypeWebPage,
		Source:    rawURL,
		CreatedAt: time.Now(), // FIXME: don't use time.NOW()
		UserID:    note.UserID,
	})
	if err != nil {
		responseChan <- llm.LLMToken{Event: "error", Data: err.Error(), Done: true}
		return err
	}
	responseChan <- llm.LLMToken{Event: "progress", Data: "Resource created."}

	// Check for cancellation
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	// Get resource contents
	resourceContents, err := getResourceContents(*persistedResource)
	if err != nil {
		responseChan <- llm.LLMToken{Event: "error", Data: err.Error(), Done: true}
		return err
	}

	responseChan <- llm.LLMToken{Event: "progress", Data: "Resource contents fetched."}

	// Check for cancellation
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	// Create document
	persistedDoc, err := insertDocument(Document{
		ResourceID: *persistedResource.ID,
		Title:      resourceContents.Title,
		Content:    resourceContents.Content,
		Images:     resourceContents.Images,
		UserID:     note.UserID,
		CreatedAt:  time.Now(), // FIXME: don't use time.NOW()
	})
	if err != nil {
		responseChan <- llm.LLMToken{Event: "error", Data: err.Error(), Done: true}
		return err
	}

	responseChan <- llm.LLMToken{Event: "progress", Data: "Document created."}

	// Check for cancellation
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	// Summarize document
	summary, err := summarizeDocument(*persistedDoc, responseChan)
	if err != nil {
		responseChan <- llm.LLMToken{Event: "error", Data: err.Error(), Done: true}
		return err
	}

	responseChan <- llm.LLMToken{Event: "progress", Data: "Document summarized."}

	// Check for cancellation
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	// Update note with summary
	sections := []notes.NoteSection{}
	sections = append(sections, notes.NewTextSection("Key Points", strings.Join(summary.KeyPoints, "\n")))
	sections = append(sections, notes.NewTextSection("Take Aways", strings.Join(summary.TakeAways, "\n")))
	sections = append(sections, notes.NewTextSection("Applications", strings.Join(summary.Applications, "\n")))

	note.DocumentID = persistedDoc.ID
	note.Title = summary.Title
	note.Summary = summary.Summary
	note.Tags = summary.Tags
	note.Sections = sections

	err = notes.UpdateNote(*note)
	if err != nil {
		responseChan <- llm.LLMToken{Event: "error", Data: err.Error(), Done: true}
		return err
	}

	responseChan <- llm.LLMToken{Event: "progress", Data: "Note updated."}
	responseChan <- llm.LLMToken{Event: "complete", Data: "Knowledge pipeline completed successfully.", Done: true}

	return nil
}
