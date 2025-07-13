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
	go install gotest.tools/gotestsum@latest
	mkdir -p test-results
	gotestsum --format pkgname \
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
	

