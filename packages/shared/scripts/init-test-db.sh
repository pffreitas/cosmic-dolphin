#!/bin/bash
set -e

echo "Initializing test database with Supabase migrations..."

# Create the database if it doesn't exist
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname="$POSTGRES_DB" <<-EOSQL
    -- Enable UUID extension
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- Enable vector extension if available (optional, for embeddings)
    CREATE EXTENSION IF NOT EXISTS vector;
EOSQL

echo "Database extensions created successfully"

# Execute migrations in timestamp order
migration_dir="/supabase/migrations"

if [ -d "$migration_dir" ]; then
    echo "Found migrations directory: $migration_dir"

    # Get all .sql files and sort them by timestamp prefix
    for migration_file in $(ls "$migration_dir"/*.sql 2>/dev/null | sort); do
        if [ -f "$migration_file" ]; then
            echo "Executing migration: $(basename "$migration_file")"
            psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname="$POSTGRES_DB" -f "$migration_file"
            echo "✓ Migration completed: $(basename "$migration_file")"
        fi
    done

    echo "All migrations executed successfully"
else
    echo "Warning: Migrations directory not found at $migration_dir"
fi

echo "Test database initialization completed"