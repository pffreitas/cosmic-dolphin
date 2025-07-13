package db

import (
	"context"
	"cosmic-dolphin/config"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var DBPool *pgxpool.Pool

func Init() error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Parse the connection string and configure the pool
	pgConfig, err := pgxpool.ParseConfig(config.GetConfig(config.PgConnString))
	if err != nil {
		log.Fatalf("Unable to parse database config: %v\n", err)
		return err
	}

	// Configure connection pool settings
	pgConfig.MaxConns = 50                       // Maximum number of connections
	pgConfig.MinConns = 5                        // Minimum number of connections
	pgConfig.MaxConnLifetime = 30 * time.Minute  // Maximum connection lifetime
	pgConfig.MaxConnIdleTime = 5 * time.Minute   // Maximum idle time
	pgConfig.HealthCheckPeriod = 1 * time.Minute // Health check interval

	// Configure connection timeouts
	pgConfig.ConnConfig.ConnectTimeout = 10 * time.Second

	DBPool, err = pgxpool.NewWithConfig(ctx, pgConfig)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v\n", err)
		return err
	}

	// Test the connection
	if err := DBPool.Ping(ctx); err != nil {
		log.Fatalf("Unable to ping database: %v\n", err)
		return err
	}

	return nil
}

func Close() {
	if DBPool != nil {
		DBPool.Close()
	}
}
