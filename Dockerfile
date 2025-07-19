# Build stage
FROM golang:1.24.4-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies for building
RUN apk add --no-cache git ca-certificates

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o cosmic-dolphin .

# Final stage - Switch to Debian slim for better Python package compatibility
FROM python:3.11-slim

# Install ca-certificates and update packages
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user
RUN groupadd -g 1001 appgroup && \
    useradd -r -u 1001 -g appgroup appuser

WORKDIR /root/

# Copy the binary from builder stage
COPY --from=builder /app/cosmic-dolphin .

# Copy migrations directory
COPY --from=builder /app/migrations ./migrations

# Create scripts directory and copy Python script
RUN mkdir -p ./scripts
COPY --from=builder /app/scripts/extract_content.py ./scripts/
RUN chmod +x ./scripts/extract_content.py

# Install markitdown for document processing
RUN pip3 install --no-cache-dir 'markitdown>=0.1.0'

# Change ownership to the non-root user
RUN chown -R appuser:appgroup /root

# Switch to non-root user
USER appuser

# Expose port (adjust if your app uses a different port)
EXPOSE 8080

# Command to run the application
CMD ["./cosmic-dolphin"] 