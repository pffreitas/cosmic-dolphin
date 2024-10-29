package db

import (
	"context"
	"cosmic-dolphin/config"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
)

var DBPool *pgxpool.Pool

func Init() error {
	ctx := context.Background()
	var err error
	DBPool, err = pgxpool.New(ctx, config.GetConfig(config.PgConnString))
	if err != nil {
		log.Fatalf("Unable to connect to database: %v\n", err)
		return err
	}

	return nil
}

func Close() {
	if DBPool != nil {
		DBPool.Close()
	}
}
