package cosmicswarm

import (
	"log/slog"
	"os"
)

var logger *slog.Logger

// init initializes the default logger
func init() {
	// Initialize with a default logger (Info level, JSON format)
	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})
	logger = slog.New(handler)
}

// initializeLoggerWithDefaults initializes the logger based on config
func initializeLoggerWithDefaults() {
	level := slog.LevelDebug

	handler := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: level,
	})

	logger = slog.New(handler)
}
