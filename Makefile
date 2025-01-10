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

DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres?sslmode=disable

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
	go test -json ./... | tparse -all 

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