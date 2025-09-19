
.PHONY: db-push
db-push-dev:
	@echo "Pushing database schema to Supabase"
	@set -a; source .env.dev; set +a; \
	npx supabase link --project-ref $${SUPABASE_PROJECT_REF}
	npx supabase db push