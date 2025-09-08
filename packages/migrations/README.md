# Database Migrations

This directory contains Supabase database migrations for the Cosmic Dolphin project.

## Running Migrations

To run migrations against your Supabase project:

```bash
# Login to Supabase (if not already logged in)
supabase login

# Link to your project (if not already linked)
supabase link --project-ref svoivlwoxpxfgkeopyvr

# Apply migrations to your remote database
supabase db push

# Or to apply a specific migration
supabase migration up --file 20240908_001_setup_pgmq.sql
```

## Migration Files

- `20240908_001_setup_pgmq.sql` - Sets up the pgmq (PostgreSQL Message Queue) extension and creates the necessary queues for the worker service

## Local Development

For local development with Supabase:

```bash
# Start local Supabase
supabase start

# Apply migrations locally
supabase db reset

# Or apply migrations without reset
supabase migration up
```

## Adding New Migrations

Create new migration files with the naming convention:
`YYYYMMDD_NNN_description.sql`

Where:
- `YYYYMMDD` is the date
- `NNN` is a sequential number (001, 002, etc.)
- `description` is a brief description of the migration

Example:
```bash
# Create a new migration
supabase migration new add_user_preferences_table
```