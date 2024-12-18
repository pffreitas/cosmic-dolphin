package notes

import (
	"context"
	"cosmic-dolphin/pipeline"
	"reflect"

	"github.com/riverqueue/river"
	"github.com/sirupsen/logrus"
)

type ProcessNotePipelineJobArgs struct {
	PipelineID *int64
}

func (ProcessNotePipelineJobArgs) Kind() string { return "ProcessNotePipelineJob" }

type ProcessNotePipelineJobWorker struct {
	river.WorkerDefaults[ProcessNotePipelineJobArgs]
}

func (w *ProcessNotePipelineJobWorker) Work(ctx context.Context, job *river.Job[ProcessNotePipelineJobArgs]) error {
	pipe, err := pipeline.GetPipelineByID[ProcessNotePipelineArgs](*job.Args.PipelineID)
	if err != nil {
		return err
	}

	err = PipeSpec().Run(pipe)
	if err != nil {
		return err
	}

	return nil
}

func PipeSpec() *pipeline.PipelineSpec[ProcessNotePipelineArgs] {
	pipeSpec := pipeline.NewPipelineSpec[ProcessNotePipelineArgs]("process_note")

	for _, processor := range notesProcessors {
		pipeSpec.AddStageHandler(pipeline.StageKey(reflect.TypeOf(processor).Name()), func(input pipeline.Args[ProcessNotePipelineArgs]) (pipeline.Args[ProcessNotePipelineArgs], error) {
			logrus.WithField("processor", reflect.TypeOf(processor)).Info("Processing note")

			err := processor.ProcessNote(input.Params.NoteID, input.UserID)
			if err != nil {
				logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to process note")
			}

			return input, nil
		})
	}

	return pipeSpec
}
