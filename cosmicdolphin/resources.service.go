package cosmicdolphin

import (
	"encoding/json"
	"fmt"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/sirupsen/logrus"
)

// ProcessedContentResponse represents the JSON response from the Python docling script
type ProcessedContentResponse struct {
	Titles          []string `json:"titles"`
	Images          []Image  `json:"images"`
	MarkdownContent string   `json:"markdown_content"`
	Metadata        Metadata `json:"metadata"`
	Status          string   `json:"status"`
	Error           string   `json:"error,omitempty"`
}

func ProcessResource(noteID int64, userID string, URL string) (*Resource, string, error) {
	logrus.WithFields(logrus.Fields{"url": URL}).Info("Getting content for resource using docling")

	resourceContent, err := extractResourceContent(URL)
	if err != nil {
		logrus.WithFields(logrus.Fields{"error": err, "url": URL}).Error("Failed to extract content with docling")
		return nil, "", err
	}

	// Extract OpenGraph data from metadata and content
	openGraph := extractOpenGraphFromContent(resourceContent, URL)

	// Create resource with OpenGraph and full metadata
	resource, err := insertResource(Resource{
		NoteID:    noteID,
		Type:      ResourceTypeWebPage,
		Source:    URL,
		OpenGraph: openGraph,
		Metadata:  resourceContent.Metadata,
		UserMeta:  make(map[ResourceMetadataKey]interface{}),
		CreatedAt: time.Now(),
		UserID:    userID,
	})

	if err != nil {
		return nil, "", err
	}

	textContent, err := json.Marshal(resourceContent)
	if err != nil {
		return nil, "", err
	}

	return resource, string(textContent), nil
}

func extractResourceContent(url string) (*ProcessedContentResponse, error) {
	scriptPath := filepath.Join("scripts", "extract_content.py")

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

	var response ProcessedContentResponse
	if err := json.Unmarshal(output, &response); err != nil {
		logrus.WithFields(logrus.Fields{
			"error":  err,
			"output": string(output),
		}).Error("Failed to parse JSON response from Python script")
		return nil, fmt.Errorf("failed to parse JSON response: %w", err)
	}

	if response.Error != "" {
		return nil, fmt.Errorf("docling extraction failed: %s", response.Error)
	}

	return &response, nil
}

// extractOpenGraphFromContent creates OpenGraph struct from extracted content and metadata
func extractOpenGraphFromContent(content *ProcessedContentResponse, url string) OpenGraph {
	og := OpenGraph{
		URL:  url,
		Type: "website", // Default to website, can be overridden by metadata
	}

	metatags, ok := content.Metadata["meta_tags"].(map[string]interface{})
	if !ok {
		logrus.WithFields(logrus.Fields{"metadata": content.Metadata}).Error("Failed to extract meta tags")
		return og
	}

	// Extract title - prefer og:title from metadata, fallback to first title from content
	if ogTitle, exists := metatags["og:title"]; exists {
		if title, ok := ogTitle.(string); ok {
			og.Title = title
		}
	} else if len(content.Titles) > 0 {
		og.Title = content.Titles[0]
	} else {
		og.Title = "Untitled"
	}

	// Extract image - prefer og:image from metadata, fallback to first image from content
	if ogImage, exists := metatags["og:image"]; exists {
		if image, ok := ogImage.(string); ok {
			og.Image = image
		}
	} else if len(content.Images) > 0 {
		og.Image = content.Images[0].Src
		og.ImageAlt = content.Images[0].Alt
	}

	// Extract description from metadata
	if ogDesc, exists := metatags["og:description"]; exists {
		if desc, ok := ogDesc.(string); ok {

			og.Description = desc

		}
	} else if desc, exists := metatags["description"]; exists {
		if descStr, ok := desc.(string); ok {
			og.Description = descStr
		}
	}

	// Extract OpenGraph type
	if ogType, exists := metatags["og:type"]; exists {
		if typeStr, ok := ogType.(string); ok {
			og.Type = typeStr
		}
	}

	// Extract site name
	if siteName, exists := metatags["og:site_name"]; exists {
		if name, ok := siteName.(string); ok {
			og.SiteName = name
		}
	}

	// Extract locale
	if locale, exists := metatags["og:locale"]; exists {
		if localeStr, ok := locale.(string); ok {
			og.Locale = localeStr
		}
	}

	// Extract image properties
	if imgWidth, exists := metatags["og:image:width"]; exists {
		if widthStr, ok := imgWidth.(string); ok {
			if width, err := strconv.Atoi(widthStr); err == nil {
				og.ImageWidth = width
			}
		} else if width, ok := imgWidth.(float64); ok {
			og.ImageWidth = int(width)
		}

	}

	if imgHeight, exists := metatags["og:image:height"]; exists {
		if heightStr, ok := imgHeight.(string); ok {
			if height, err := strconv.Atoi(heightStr); err == nil {
				og.ImageHeight = height
			}
		} else if height, ok := imgHeight.(float64); ok {
			og.ImageHeight = int(height)
		}

	}

	if imgType, exists := metatags["og:image:type"]; exists {
		if typeStr, ok := imgType.(string); ok {
			og.ImageType = typeStr
		}

	}

	if imgAlt, exists := metatags["og:image:alt"]; exists {
		if altStr, ok := imgAlt.(string); ok {
			og.ImageAlt = altStr
		}
	}

	//
	// Extract article properties (if
	//  og:type is "article")
	if og.Type == "article" {
		if author, exists := metatags["article:author"]; exists {
			if authorStr, ok := author.(string); ok {
				og.ArticleAuthor = authorStr
			}
		}

		if section, exists := content.Metadata["article:section"]; exists {
			if sectionStr, ok := section.(string); ok {
				og.ArticleSection = sectionStr
			}
		}

		if tags, exists := content.Metadata["article:tag"]; exists {
			switch tagsVal := tags.(type) {
			case string:
				// Single tag as string
				og.ArticleTags = []string{tagsVal}
			case []interface{}:
				// Multiple tags as array
				for _, tag := range tagsVal {
					if tagStr, ok := tag.(string); ok {
						og.ArticleTags = append(og.ArticleTags, tagStr)
					}
				}
			case []string:
				// Already string array
				og.ArticleTags = tagsVal
			}
		}

		// Parse article:published_time
		if pubTime, exists := content.Metadata["article:published_time"]; exists {
			if pubTimeStr, ok := pubTime.(string); ok {
				if parsedTime, err := parseArticleTime(pubTimeStr); err == nil {
					og.ArticlePublishedTime = parsedTime
				}
			}
		}

		// Parse article:modified_time
		if modTime, exists := content.Metadata["article:modified_time"]; exists {
			if modTimeStr, ok := modTime.(string); ok {
				if parsedTime, err := parseArticleTime(modTimeStr); err == nil {
					og.ArticleModifiedTime = parsedTime
				}
			}
		}
	}

	return og
}

// parseArticleTime attempts to parse article time in various ISO formats
func parseArticleTime(timeStr string) (time.Time, error) {
	formats := []string{
		time.RFC3339,
		"2006-01-02T15:04:05",
		"2006-01-02T15:04:05Z",
		"2006-01-02",
	}

	timeStr = strings.TrimSpace(timeStr)

	for _, format := range formats {
		if parsedTime, err := time.Parse(format, timeStr); err == nil {
			return parsedTime, nil
		}
	}

	return time.Time{}, fmt.Errorf("unable to parse time: %s", timeStr)
}
