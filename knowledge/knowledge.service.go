package knowledge

import (
	"cosmic-dolphin/notes"
	"cosmic-dolphin/pipeline"
	"time"

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

	pipeSpec.AddStageHandler(pipeline.StageKey("Insert Resource"), func(input pipeline.Args[KnowledgePipelineArgs]) (pipeline.Args[KnowledgePipelineArgs], error) {
		noteID := input.Params.NoteID
		userID := input.Params.UserID

		note, err := notes.GetNoteByID(noteID, userID)
		if err != nil {
			return input, err
		}

		persistedResource, err := insertResource(Resource{
			NoteID:    *note.ID,
			Type:      ResourceTypeWebPage,
			Source:    note.RawBody,
			CreatedAt: time.Now(), // FIXME: don't use time.NOW()
			UserID:    note.UserID,
		})
		if err != nil {
			return input, err
		}

		input.Params.ResourceID = persistedResource.ID

		return input, nil
	})

	pipeSpec.AddStageHandler(pipeline.StageKey("Get Resource Contents"), func(input pipeline.Args[KnowledgePipelineArgs]) (pipeline.Args[KnowledgePipelineArgs], error) {
		persistedResource, err := fetchResourceByNoteID(input.Params.NoteID)
		if err != nil {
			return input, err
		}

		document, err := getResourceContents(*persistedResource)
		if err != nil {
			return input, err
		}

		persistedDoc, err := insertDocument(document)
		if err != nil {
			return input, err
		}

		input.Params.DocumentID = persistedDoc.ID

		return input, nil
	})

	pipeSpec.AddStageHandler(pipeline.StageKey("Embed Document"), func(input pipeline.Args[KnowledgePipelineArgs]) (pipeline.Args[KnowledgePipelineArgs], error) {
		doc, err := fetchDocumentByID(*input.Params.DocumentID)
		if err != nil {
			return input, err
		}

		err = embedDocument(*doc)
		if err != nil {
			return input, err
		}

		return input, nil
	})

	pipeSpec.AddStageHandler(pipeline.StageKey("Summarize"), func(input pipeline.Args[KnowledgePipelineArgs]) (pipeline.Args[KnowledgePipelineArgs], error) {
		err := sumarize(*input.Params.DocumentID)
		if err != nil {
			return input, err
		}

		return input, nil
	})

	return pipeSpec, nil

}
