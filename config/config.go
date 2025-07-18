package config

import (
	"os"

	"github.com/joho/godotenv"
)

type ConfigKey string

const (
	Environment  ConfigKey = "ENV"
	Port         ConfigKey = "PORT"
	OpenAIKey    ConfigKey = "OPENAI_API_KEY"
	PgConnString ConfigKey = "PG_CONN"
	JWTSecret    ConfigKey = "JWT_SECRET"
)

func LoadEnv(path string) error {
	return godotenv.Load(path)
}

func GetConfig(key ConfigKey) string {
	return os.Getenv(string(key))
}
