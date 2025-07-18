package knowledge

import (
	"context"
	"cosmic-dolphin/llm"
	"cosmic-dolphin/llm/agents"
	"cosmic-dolphin/notes"
	"time"

	swarmLlm "github.com/pffreitas/swarmgo/llm"
	"github.com/sirupsen/logrus"
)

type KnowledgeResponse struct {
	Event  string `json:"event"`
	Data   string `json:"data"`
	NoteID *int64 `json:"note_id,omitempty"`
	Done   bool   `json:"done"`
}

func runKnowledgePipelineAndStream(ctx context.Context, userID string, rawURL string, noteID int64, cosmicStreamHandler *llm.CosmicStreamHandler) error {

	// Add timeout to prevent long-running operations
	ctx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()

	note, err := notes.GetNoteByID(noteID, userID)
	if err != nil {
		cosmicStreamHandler.OnError(err)
		return err
	}

	// Send initial progress message
	cosmicStreamHandler.OnToken("Starting document processing...")

	cosmicAgent := agents.NewCosmicAgent()
	err = cosmicAgent.Run(ctx, rawURL, map[string]interface{}{
		"note_id": noteID,
		"user_id": note.UserID,
	}, cosmicStreamHandler)

	if err != nil {
		cosmicStreamHandler.OnError(err)
		return err
	}

	logrus.Info("Cosmic agent completed, sending progress messages...")

	// Send progress messages after the agent completes
	cosmicStreamHandler.OnToken("Document summarized.")
	logrus.Info("Sent: Document summarized.")

	// Check for cancellation
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	cosmicStreamHandler.OnToken("Note updated.")
	logrus.Info("Sent: Note updated.")

	cosmicStreamHandler.OnToken("Knowledge pipeline completed successfully.")
	logrus.Info("Sent: Knowledge pipeline completed successfully.")

	// Send final completion
	cosmicStreamHandler.OnComplete(swarmLlm.Message{
		Role:    swarmLlm.RoleAssistant,
		Content: "Knowledge pipeline completed successfully.",
	})
	logrus.Info("Sent final completion.")

	return nil
}
