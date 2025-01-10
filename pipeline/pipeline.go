package pipeline

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/sirupsen/logrus"
)

type PipelineSpec[T any] struct {
	Name          string
	StageHandlers map[StageKey]StageHandler[T]
}

type Pipeline[T any] struct {
	ID          *int64
	Name        string
	Args        Args[T]
	Stages      []Stage
	UserID      string    `json:"user_id"`
	ReferenceID *int64    `json:"reference_id"`
	CreatedAt   time.Time `json:"created_at"`
}

type StageKey string

type StageStatus string

const (
	StageStatusPending  StageStatus = "pending"
	StageStatusRunning  StageStatus = "running"
	StageStatusComplete StageStatus = "complete"
	StageStatusFailed   StageStatus = "failed"
)

type Stage struct {
	ID         *int64
	PipelineID *int64
	Key        StageKey
	Status     StageStatus
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type StageHandler[T any] func(Args[T]) (Args[T], error)

type Args[T any] struct {
	Params      T
	UserID      string
	paramsBytes []byte
}

func (a *Args[T]) UnmarshalArgs() error {
	err := json.Unmarshal(a.paramsBytes, &a.Params)
	if err != nil {
		fmt.Println(err)
		return err
	}
	return nil
}

func NewArgs[T any](params T) (Args[T], error) {
	return Args[T]{Params: params}, nil
}

func NewArgsFromBytes[T any](data []byte) (Args[T], error) {
	args := Args[T]{paramsBytes: data}
	args.UnmarshalArgs()
	return args, nil
}

func NewPipeline[T any](args Args[T], UserID string, ReferenceID *int64) *Pipeline[T] {
	return &Pipeline[T]{
		Args:        args,
		UserID:      UserID,
		ReferenceID: ReferenceID,
	}
}

func NewPipelineSpec[T any](name string) *PipelineSpec[T] {
	return &PipelineSpec[T]{
		Name:          name,
		StageHandlers: make(map[StageKey]StageHandler[T]),
	}
}

func (p *PipelineSpec[T]) AddStageHandler(stageKey StageKey, handler StageHandler[T]) *PipelineSpec[T] {
	p.StageHandlers[stageKey] = handler
	return p
}

func (ps *PipelineSpec[T]) Run(pipe *Pipeline[T]) error {
	args := pipe.Args
	args.UserID = pipe.UserID

	// insert pipeline

	for stageHandlerKey, handler := range ps.StageHandlers {
		logrus.WithFields(logrus.Fields{"key": stageHandlerKey}).Info("Running stage")

		stage, err := InsertStage(&Stage{
			PipelineID: pipe.ID,
			Key:        stageHandlerKey,
			Status:     StageStatusPending,
		})
		if err != nil {
			return err
		}

		resArgs, err := handler(args)
		if err != nil {
			return err
		}

		args = resArgs

		// UpdatePipelineArgs(pipe.ID, args)
		UpdateStageStatus(pipe.ID, stage.ID, StageStatusComplete)
	}

	// update pipeline status

	return nil
}
