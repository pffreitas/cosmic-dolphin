package knowledge

import (
	"context"
	"cosmic-dolphin/llm"
	"cosmic-dolphin/llm/agents"
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

	// Add timeout to prevent long-running operations
	ctx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

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

	// Create a capture channel and buffer to collect streamed response
	captureChan := make(chan llm.LLMToken, 100)
	var capturedContent strings.Builder
	captureDone := make(chan bool, 1)

	// Start goroutine to capture content and forward to original channel
	go func() {
		defer func() {
			captureDone <- true
		}()

		for token := range captureChan {
			// Forward token to original channel
			responseChan <- token

			// Capture content tokens for persistence
			if token.Event == "content" && token.Data != "" {
				capturedContent.WriteString(token.Data)
			}
		}
	}()

	err = agents.RunSummaryAgent(persistedDoc.Content, captureChan)

	// Close capture channel to signal end of streaming
	close(captureChan)

	// Wait for capture goroutine to finish processing all tokens
	<-captureDone

	if err != nil {
		responseChan <- llm.LLMToken{Event: "error", Data: err.Error(), Done: true}
		return err
	}

	// Update note with captured summary
	if capturedContent.Len() > 0 {
		note.Body = capturedContent.String()
		err = notes.UpdateNote(*note)
		if err != nil {
			responseChan <- llm.LLMToken{Event: "error", Data: err.Error(), Done: true}
			return err
		}
	}

	responseChan <- llm.LLMToken{Event: "progress", Data: "Document summarized."}

	// Check for cancellation
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	err = notes.UpdateNote(*note)
	if err != nil {
		responseChan <- llm.LLMToken{Event: "error", Data: err.Error(), Done: true}
		return err
	}

	responseChan <- llm.LLMToken{Event: "progress", Data: "Note updated."}
	responseChan <- llm.LLMToken{Event: "complete", Data: "Knowledge pipeline completed successfully.", Done: true}

	return nil
}
