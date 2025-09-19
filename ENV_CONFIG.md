# Environment Configuration Guide

## Local Development

1. Copy the `.env.example` file to `.env`:

   ```bash
   cp .env.example .env
   ```

2. Update the values in `.env` with your local configuration:
   - **DATABASE_URL**: Your local PostgreSQL connection string or Supabase URL
   - **JWT_SECRET**: A secure secret for JWT token signing
   - **API keys**: Add your OpenAI, Anthropic, or other service API keys

## Docker Development

The Docker Compose setup uses the following default values:

- PostgreSQL: `postgresql://postgres:password@postgres:5432/cosmic_dolphin`

## Production Deployment

For DigitalOcean App Platform, set these environment variables in your app settings:

### Required Environment Variables

- `NODE_ENV=production`
- `DATABASE_URL` (your Supabase connection string)
- `JWT_SECRET` (secure secret for production)

### Optional Environment Variables

- `LOG_LEVEL=info`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`

## Security Notes

- Never commit `.env` files to version control
- Use strong, unique secrets for production
- Rotate JWT secrets regularly
- Use secure connection strings (SSL enabled) for production databases
