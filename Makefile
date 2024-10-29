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