package knowledge

import (
	"context"
	"cosmic-dolphin/llm"
	"cosmic-dolphin/llm/agents"
	"cosmic-dolphin/notes"
	"time"

	swarmLlm "github.com/allurisravanth/swarmgo/llm"
)

type KnowledgeResponse struct {
	Event  string `json:"event"`
	Data   string `json:"data"`
	NoteID *int64 `json:"note_id,omitempty"`
	Done   bool   `json:"done"`
}

func runKnowledgePipelineAndStream(ctx context.Context, userID string, rawURL string, noteID int64, cosmicStreamHandler *llm.CosmicStreamHandler) error {
	defer close(cosmicStreamHandler.ResponseChan)

	// Add timeout to prevent long-running operations
	ctx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	note, err := notes.GetNoteByID(noteID, userID)
	if err != nil {
		cosmicStreamHandler.OnError(err)
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
		cosmicStreamHandler.OnError(err)
		return err
	}
	cosmicStreamHandler.OnToken("Resource created.") // FIXME: add OnProgress method

	// Check for cancellation
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	// Get resource contents
	resourceContents, err := getResourceContents(*persistedResource)
	if err != nil {
		cosmicStreamHandler.OnError(err)
		return err
	}

	cosmicStreamHandler.OnToken("Resource contents fetched.") // FIXME: add OnProgress method

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
		cosmicStreamHandler.OnError(err)
		return err
	}

	cosmicStreamHandler.OnToken("Document created.") // FIXME: add OnProgress method

	// Check for cancellation
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	err = agents.RunSummaryAgent(noteID, note.UserID, persistedDoc.Content, cosmicStreamHandler)

	if err != nil {
		cosmicStreamHandler.OnError(err)
		return err
	}

	cosmicStreamHandler.OnToken("Document summarized.") // FIXME: add OnProgress method

	// Check for cancellation
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	cosmicStreamHandler.OnToken("Note updated.") // FIXME: add OnProgress method
	cosmicStreamHandler.OnComplete(swarmLlm.Message{
		Role:    swarmLlm.RoleAssistant,
		Content: "Knowledge pipeline completed successfully.",
	}) // FIXME: rethink this; mayber we don't need to call OnComplete here

	return nil
}
