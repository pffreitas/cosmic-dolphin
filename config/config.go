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
	SupabaseURL  ConfigKey = "SUPABASE_URL"
	SupabaseKey  ConfigKey = "SUPABASE_KEY"
	PgConnString ConfigKey = "PG_CONN"
)

func LoadEnv(path string) error {
	return godotenv.Load(path)
}

func GetConfig(key ConfigKey) string {
	return os.Getenv(string(key))
}
