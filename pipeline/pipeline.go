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
	ID          *int64      `json:"id"`
	Name        string      `json:"-"`
	Args        Args[T]     `json:"-"`
	Status      StageStatus `json:"status"`
	Stages      []Stage     `json:"stages"`
	UserID      string      `json:"-"`
	ReferenceID *int64      `json:"refId"`
	CreatedAt   time.Time   `json:"createdAt"`
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
	ID         *int64      `json:"id"`
	PipelineID *int64      `json:"-"`
	Name       string      `json:"name"`
	Key        StageKey    `json:"key"`
	Status     StageStatus `json:"status"`
	CreatedAt  time.Time   `json:"createdAt"`
	UpdatedAt  time.Time   `json:"updatedAt"`
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
		Name:        "",
		Args:        args,
		UserID:      UserID,
		ReferenceID: ReferenceID,
		Status:      StageStatusPending,
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

	var stageErr error

	for stageHandlerKey, handler := range ps.StageHandlers {
		logrus.WithFields(logrus.Fields{"key": stageHandlerKey}).Info("Running stage")

		stage, err := InsertStage(&Stage{
			PipelineID: pipe.ID,
			Key:        stageHandlerKey,
			Status:     StageStatusPending,
		})
		if err != nil {
			stageErr = err

		}

		resArgs, err := handler(args)
		if err != nil {
			stageErr = err
		}

		args = resArgs

		// UpdatePipelineArgs(pipe.ID, args)

		if stageErr != nil {
			UpdateStageStatus(pipe.ID, stage.ID, StageStatusFailed)
			break
		} else {
			UpdateStageStatus(pipe.ID, stage.ID, StageStatusComplete)
		}
	}

	if stageErr != nil {
		UpdatePipelineStatus(*pipe.ID, StageStatusFailed)
	} else {
		UpdatePipelineStatus(*pipe.ID, StageStatusComplete)
	}

	return nil
}
