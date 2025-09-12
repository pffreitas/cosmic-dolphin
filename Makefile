# Define the Go command
GO := go

# Define the binary name
BINARY_NAME := cosmic-dolphin

# Define the source directory
SRC_DIR := .

# Define the output directory
OUT_DIR := bin

# Define the test directory
TEST_DIR := ./...

# Default target: build the project
.PHONY: all
all: build

# Build the project
.PHONY: build
build:
	@echo "Building $(BINARY_NAME)"
	$(GO) build -o $(OUT_DIR)/$(BINARY_NAME) $(SRC_DIR) 

# Run tests
.PHONY: test
test:
	@echo "Running tests"
	$(GO) test $(TEST_DIR) -v

.PHONY: testp
testp: 
	rm -rf test-results
	go install gotest.tools/gotestsum@latest
	mkdir -p test-results
	gotestsum --format standard-verbose \
        --junitfile test-results/unit-tests.xml \
        --jsonfile test-results/unit-tests.json \
    	-- -coverprofile=test-results/coverage.out ./...

# Clean up build artifacts
.PHONY: clean
clean:
	@echo "Cleaning up $(OUT_DIR)"
	rm -rf $(OUT_DIR)

# Run the application
.PHONY: run
run: build
	@echo "Running $(BINARY_NAME)"
	./$(OUT_DIR)/$(BINARY_NAME)

.PHONY: db-migrate-install
db-migrate-install:
	@echo "Installing river"
	$(GO) install github.com/riverqueue/river/cmd/river@latest
	$(GO) install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

.PHONY: db-migrate
db-migrate:
	@echo "Running database migrations"
	river migrate-up --database-url "$(DATABASE_URL)"
	migrate -path ./migrations -database "$(DATABASE_URL)" up

.PHONY: db-cleanup
db-cleanup:
	@echo "Running database cleanup script"
	psql $(DATABASE_URL) -f db-scripts/cleanup.sql

.PHONY: db-push
db-push:
	@echo "Pushing database schema to Supabase"
	@set -a; source .env.dev; set +a; \
	npx supabase link --project-ref $${SUPABASE_PROJECT_REF}
	npx supabase db push

.PHONY: db-migrate-local
db-migrate-local:
	@echo "Running database migrations"
	@set -a; source .dev.env; set +a; \
	$(MAKE) db-migrate


.PHONY: run-tests-local
run-tests-local:
	@echo "Starting PostgreSQL database in Docker"
	@set -a; source .dev.env; set +a; \
	echo $$PG_CONN; \
	$(MAKE) testp

.PHONY: docker-up
docker-up:
	@echo "Starting Docker Compose with environment variables from .env.example"
	docker-compose --env-file .env.dev up -d

.PHONY: docker-down
docker-down:
	@echo "Stopping Docker Compose"
	docker-compose down

.PHONY: docker-logs
docker-logs:
	@echo "Viewing Docker Compose logs"
	docker-compose logs -f

.PHONY: docker-restart
drs:
	@echo "Restarting Docker Compose"
	docker-compose down
	docker-compose up -d
	docker-compose logs -f

.PHONY: docker-purge
docker-purge:
	@echo "Purging all Docker containers, images, volumes, and networks"
	@echo "Stopping all running containers..."
	-docker stop $$(docker ps -aq) 2>/dev/null || true
	@echo "Removing all containers..."
	-docker rm $$(docker ps -aq) 2>/dev/null || true
	@echo "Removing all images..."
	-docker rmi $$(docker images -q) 2>/dev/null || true
	@echo "Removing all volumes..."
	-docker volume rm $$(docker volume ls -q) 2>/dev/null || true
	@echo "Removing all networks..."
	-docker network rm $$(docker network ls -q) 2>/dev/null || true
	@echo "Running system prune..."
	docker system prune -af --volumes
	@echo "Docker purge complete!"

