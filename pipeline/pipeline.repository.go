package pipeline

import (
	"context"
	"cosmic-dolphin/db"
	"encoding/json"
	"fmt"
	"time"

	"github.com/sirupsen/logrus"
)

func InsertPipeline[T any](pipeline *Pipeline[T]) (*Pipeline[T], error) {
	logrus.WithFields(logrus.Fields{"name": pipeline.Name}).Info("Inserting pipeline")

	query := `
        INSERT INTO pipelines (name, args, user_id, reference_id, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, created_at
    `

	argsJSON, err := json.Marshal(pipeline.Args.Params)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal args: %w", err)
	}

	var pipelineID int64
	var createdAt time.Time
	err = db.DBPool.QueryRow(
		context.Background(),
		query,
		pipeline.Name,
		argsJSON,
		pipeline.UserID,
		pipeline.ReferenceID,
		pipeline.Status,
	).Scan(&pipelineID, &createdAt)
	if err != nil {
		return nil, fmt.Errorf("failed to insert pipeline: %w", err)
	}

	persistedStages, err := insertPipelineStages(&pipeline.Stages)
	if err != nil {
		return nil, err
	}

	pipeline.ID = &pipelineID
	pipeline.CreatedAt = createdAt
	pipeline.Stages = persistedStages

	return pipeline, nil
}

func insertPipelineStages(stages *[]Stage) ([]Stage, error) {
	persistedStages := make([]Stage, 0, len(*stages))
	for _, stage := range *stages {
		persistedStage, err := InsertStage(&stage)
		if err != nil {
			return nil, err
		}

		persistedStages = append(persistedStages, *persistedStage)
	}
	return persistedStages, nil
}

func InsertStage(stage *Stage) (*Stage, error) {
	stageQuery := `
        INSERT INTO pipeline_stages (pipeline_id, key, name, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at
    `
	err := db.DBPool.QueryRow(
		context.Background(),
		stageQuery,
		stage.PipelineID,
		stage.Key,
		stage.Key,
		stage.Status,
		time.Now(),
		time.Now(),
	).Scan(&stage.ID, &stage.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to insert pipeline stage: %w", err)
	}

	return stage, nil
}

func UpdatePipelineArgs(pipelineID *int64, newArgs Args[any]) error {
	argsJSON, err := json.Marshal(newArgs.Params)
	if err != nil {
		return fmt.Errorf("failed to marshal new args: %w", err)
	}

	query := `
		UPDATE pipelines
		SET args = $1
		WHERE id = $2
	`

	_, err = db.DBPool.Exec(
		context.Background(),
		query,
		argsJSON,
		pipelineID,
	)
	if err != nil {
		return fmt.Errorf("failed to update pipeline args: %w", err)
	}

	return nil
}

func UpdatePipelineStatus(pipelineID int64, status StageStatus) error {
	query := `
		UPDATE pipelines
		SET status = $1
		WHERE id = $2
	`

	_, err := db.DBPool.Exec(
		context.Background(),
		query,
		status,
		pipelineID,
	)
	if err != nil {
		return fmt.Errorf("failed to update pipeline status: %w", err)
	}
	return nil
}

func UpdateStageStatus(pipelineID *int64, stageID *int64, status StageStatus) error {
	query := `
		UPDATE pipeline_stages
		SET status = $1, updated_at = $2
		WHERE pipeline_id = $3 AND id = $4
	`

	_, err := db.DBPool.Exec(
		context.Background(),
		query,
		status,
		time.Now(),
		&pipelineID,
		&stageID,
	)
	if err != nil {
		return fmt.Errorf("failed to update stage status: %w", err)
	}
	return nil
}

func GetPipelineByID[T any](pipelineID int64) (*Pipeline[T], error) {
	query := `
        SELECT id, name, args, user_id, reference_id, created_at
        FROM pipelines
        WHERE id = $1
    `

	var pipeline Pipeline[T]
	var argsJSON []byte

	err := db.DBPool.QueryRow(
		context.Background(),
		query,
		pipelineID,
	).Scan(
		&pipeline.ID,
		&pipeline.Name,
		&argsJSON,
		&pipeline.UserID,
		&pipeline.ReferenceID,
		&pipeline.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve pipeline: %w", err)
	}

	args, err := NewArgsFromBytes[T](argsJSON)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal args: %w", err)
	}
	pipeline.Args = args

	pipeline.Stages, err = getPipelineStages(pipelineID)
	if err != nil {
		return nil, err
	}

	return &pipeline, nil
}

func UnmarshalArgs[T any](data []byte) (*T, error) {
	var result T
	err := json.Unmarshal(data, &result)
	if err != nil {
		return nil, err
	}
	return &result, nil
}

func getPipelineStages(pipelineID int64) ([]Stage, error) {
	query := `
		SELECT id, pipeline_id, name, key, status, created_at, updated_at
		FROM pipeline_stages
		WHERE pipeline_id = $1
	`

	rows, err := db.DBPool.Query(context.Background(), query, pipelineID)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve pipeline stages: %w", err)
	}
	defer rows.Close()

	var stages []Stage
	for rows.Next() {
		var stage Stage
		err := rows.Scan(
			&stage.ID,
			&stage.PipelineID,
			&stage.Name,
			&stage.Key,
			&stage.Status,
			&stage.CreatedAt,
			&stage.UpdatedAt)

		if err != nil {
			return nil, fmt.Errorf("failed to scan pipeline stage: %w", err)
		}
		stages = append(stages, stage)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating over pipeline stages: %w", err)
	}

	return stages, nil
}

func GetPipelinesByReferenceID[T any](referenceID int64) ([]Pipeline[T], error) {
	logrus.WithFields(logrus.Fields{"reference_id": referenceID}).Info("Fetching pipelines by reference ID")
	pipelines, err := fetchPipelineByReferenceID[T](referenceID)
	if err != nil {
		return nil, err
	}

	for i := range pipelines {
		stages, err := fetchPipelineStagesByPipelineID(pipelines[i].ID)
		if err != nil {
			return nil, err
		}
		pipelines[i].Stages = stages
	}

	return pipelines, nil
}

func fetchPipelineByReferenceID[T any](referenceID int64) ([]Pipeline[T], error) {
	query := `
		SELECT id, name, args, user_id, reference_id, status, created_at
		FROM pipelines
		WHERE reference_id = $1
		ORDER BY created_at DESC
	`

	rows, err := db.DBPool.Query(context.Background(), query, referenceID)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve pipelines: %w", err)
	}
	defer rows.Close()

	var pipelines []Pipeline[T]
	for rows.Next() {
		var pipeline Pipeline[T]
		var argsJSON []byte

		err := rows.Scan(
			&pipeline.ID,
			&pipeline.Name,
			&argsJSON,
			&pipeline.UserID,
			&pipeline.ReferenceID,
			&pipeline.Status,
			&pipeline.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan pipeline: %w", err)
		}

		args, err := NewArgsFromBytes[T](argsJSON)
		if err != nil {
			return nil, fmt.Errorf("failed to unmarshal args: %w", err)
		}
		pipeline.Args = args

		pipelines = append(pipelines, pipeline)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating over pipelines: %w", err)
	}

	return pipelines, nil
}

func fetchPipelineStagesByPipelineID(pipelineID *int64) ([]Stage, error) {
	query := `
		SELECT id, pipeline_id, key, status, created_at, updated_at
		FROM pipeline_stages
		WHERE pipeline_id = $1
	`

	rows, err := db.DBPool.Query(context.Background(), query, pipelineID)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve pipeline stages: %w", err)
	}
	defer rows.Close()

	var stages []Stage
	for rows.Next() {
		var stage Stage
		err := rows.Scan(
			&stage.ID,
			&stage.PipelineID,
			&stage.Key,
			&stage.Status,
			&stage.CreatedAt,
			&stage.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan pipeline stage: %w", err)
		}
		stages = append(stages, stage)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating over pipeline stages: %w", err)
	}

	return stages, nil
}

func DeletePipelinesByReferenceID(referenceID int64) error {
	query := `
		DELETE FROM pipelines
		WHERE reference_id = $1
	`

	_, err := db.DBPool.Exec(context.Background(), query, referenceID)
	if err != nil {
		return fmt.Errorf("failed to delete pipelines: %w", err)
	}

	return nil
}
