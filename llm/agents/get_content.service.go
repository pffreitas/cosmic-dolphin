package agents

import (
	"cosmic-dolphin/utils"
	"encoding/json"
	"fmt"
	"os/exec"
	"path/filepath"

	"github.com/sirupsen/logrus"
)

type Image struct {
	Src string `json:"src"`
	Alt string `json:"alt"`
}

// DoclingResponse represents the JSON response from the Python docling script
type DoclingResponse struct {
	HTMLContent     string   `json:"html_content"`
	Titles          []string `json:"titles"`
	Images          []Image  `json:"images"`
	TextContent     string   `json:"text_content"`
	MarkdownContent string   `json:"markdown_content"`
	Status          string   `json:"status"`
	Error           string   `json:"error,omitempty"`
}

func GetResourceContents(URL string) (*DoclingResponse, error) {
	logrus.WithFields(logrus.Fields{"url": URL}).Info("Getting content for resource using docling")

	// Call the Python docling script
	content, err := extractContentWithDocling(URL)
	if err != nil {
		logrus.WithFields(logrus.Fields{"error": err, "url": URL}).Error("Failed to extract content with docling")
		return nil, err
	}

	return content, nil
}

// extractContentWithDocling calls the Python docling script to extract content from URL
func extractContentWithDocling(url string) (*DoclingResponse, error) {
	// Get the path to the Python script relative to the project root
	scriptPath := filepath.Join("scripts", "extract_content.py")

	// Execute the Python script
	cmd := exec.Command("python3", scriptPath, url)
	output, err := cmd.Output()

	if err != nil {
		if exitError, ok := err.(*exec.ExitError); ok {
			logrus.WithFields(logrus.Fields{
				"stderr":    string(exitError.Stderr),
				"exit_code": exitError.ExitCode(),
			}).Error("Python script execution failed")
			return nil, fmt.Errorf("python script failed with exit code %d: %s", exitError.ExitCode(), string(exitError.Stderr))
		}
		return nil, fmt.Errorf("failed to execute python script: %w", err)
	}

	// Parse JSON response
	var response DoclingResponse
	if err := json.Unmarshal(output, &response); err != nil {
		logrus.WithFields(logrus.Fields{
			"error":  err,
			"output": string(output),
		}).Error("Failed to parse JSON response from Python script")
		return nil, fmt.Errorf("failed to parse JSON response: %w", err)
	}

	// Check if the Python script returned an error
	if response.Error != "" {
		return nil, fmt.Errorf("docling extraction failed: %s", response.Error)
	}

	// Sanitize the HTML content
	if response.HTMLContent != "" {
		response.HTMLContent = utils.SanitizeHTML(response.HTMLContent)
	}

	return &response, nil
}
