package knowledge

import (
	"cosmic-dolphin/notes"
	"cosmic-dolphin/pipeline"

	"github.com/sirupsen/logrus"
)

var log = logrus.New()

func Init() {
	notes.AddNotesPipelines(KnowledgePipeline{})
}

type KnowledgePipeline struct{}

func (kp KnowledgePipeline) Run(noteID int64, userID string) error {
	log.WithFields(logrus.Fields{"note.id": noteID}).Info("[Knowledge] Processing note")

	pipeSpec, err := NewKnowledgePipelineSpec()
	if err != nil {
		return err
	}

	args, err := pipeline.NewArgs(KnowledgePipelineArgs{NoteID: noteID, UserID: userID})
	if err != nil {
		return err
	}

	pipe := pipeline.NewPipeline[KnowledgePipelineArgs](args, userID, &noteID)
	_, err = pipeline.InsertPipeline(pipe)
	if err != nil {
		return err
	}

	err = pipeSpec.Run(pipe)
	if err != nil {
		return err
	}

	return nil
}

type KnowledgePipelineArgs struct {
	NoteID     int64
	UserID     string
	ResourceID *int64
	DocumentID *int64
}

func NewKnowledgePipelineSpec() (*pipeline.PipelineSpec[KnowledgePipelineArgs], error) {
	pipeSpec := pipeline.NewPipelineSpec[KnowledgePipelineArgs]("knowledge_pipeline")

	return pipeSpec, nil

}
