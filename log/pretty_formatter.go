package log

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/sirupsen/logrus"
)

// PrettyJSONFormatter formats logs as pretty JSON with truncation support
type PrettyJSONFormatter struct {
	// TimestampFormat sets the format used for marshaling timestamps.
	TimestampFormat string

	// DisableTimestamp allows disabling automatic timestamps in output
	DisableTimestamp bool

	// MaxFieldLength truncates field values longer than this length
	MaxFieldLength int

	// PrettyPrint enables JSON pretty printing
	PrettyPrint bool

	// TruncationSuffix is appended to truncated values
	TruncationSuffix string
}

// Format renders a log entry as pretty JSON with truncation
func (f *PrettyJSONFormatter) Format(entry *logrus.Entry) ([]byte, error) {
	data := make(logrus.Fields, len(entry.Data)+4)

	// Copy entry data
	for k, v := range entry.Data {
		data[k] = f.truncateValue(v)
	}

	// Add standard fields
	data["level"] = entry.Level.String()
	data["msg"] = f.truncateValue(entry.Message)

	if !f.DisableTimestamp {
		timestampFormat := f.TimestampFormat
		if timestampFormat == "" {
			timestampFormat = time.RFC3339
		}
		data["time"] = entry.Time.Format(timestampFormat)
	}

	if entry.HasCaller() {
		data["caller"] = fmt.Sprintf("%s:%d", entry.Caller.File, entry.Caller.Line)
		data["func"] = entry.Caller.Function
	}

	var b []byte
	var err error

	if f.PrettyPrint {
		b, err = json.MarshalIndent(data, "", "  ")
	} else {
		b, err = json.Marshal(data)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to marshal fields to JSON: %w", err)
	}

	return append(b, '\n'), nil
}

// truncateValue truncates values that are too long
func (f *PrettyJSONFormatter) truncateValue(value interface{}) interface{} {
	if f.MaxFieldLength <= 0 {
		return value
	}

	switch v := value.(type) {
	case string:
		return f.truncateString(v)
	case []byte:
		return f.truncateString(string(v))
	case map[string]interface{}:
		return f.truncateMap(v)
	case []interface{}:
		return f.truncateSlice(v)
	default:
		// For other types, convert to JSON and check length
		jsonBytes, err := json.Marshal(v)
		if err != nil {
			return value
		}
		if len(jsonBytes) > f.MaxFieldLength {
			return f.truncateString(string(jsonBytes))
		}
		return value
	}
}

func (f *PrettyJSONFormatter) truncateString(s string) string {
	if len(s) <= f.MaxFieldLength {
		return s
	}

	suffix := f.TruncationSuffix
	if suffix == "" {
		suffix = "...[TRUNCATED]"
	}

	maxContent := f.MaxFieldLength - len(suffix)
	if maxContent < 0 {
		maxContent = 0
	}

	return s[:maxContent] + suffix
}

func (f *PrettyJSONFormatter) truncateMap(m map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{})
	for k, v := range m {
		result[k] = f.truncateValue(v)
	}
	return result
}

func (f *PrettyJSONFormatter) truncateSlice(s []interface{}) []interface{} {
	result := make([]interface{}, len(s))
	for i, v := range s {
		result[i] = f.truncateValue(v)
	}
	return result
}

// NewPrettyJSONFormatter creates a new formatter with sensible defaults
func NewPrettyJSONFormatter() *PrettyJSONFormatter {
	return &PrettyJSONFormatter{
		TimestampFormat:  time.RFC3339,
		MaxFieldLength:   1000, // Safe for most log aggregators
		PrettyPrint:      true,
		TruncationSuffix: "...[TRUNCATED]",
	}
}

// ColorizedJSONFormatter adds color coding to JSON logs for terminal output
type ColorizedJSONFormatter struct {
	*PrettyJSONFormatter
	DisableColors bool
}

// Format renders a colorized JSON log entry
func (f *ColorizedJSONFormatter) Format(entry *logrus.Entry) ([]byte, error) {
	// First get the regular JSON format
	jsonBytes, err := f.PrettyJSONFormatter.Format(entry)
	if err != nil {
		return nil, err
	}

	if f.DisableColors {
		return jsonBytes, nil
	}

	// Add color based on log level
	var colorCode string
	switch entry.Level {
	case logrus.DebugLevel:
		colorCode = "\033[36m" // Cyan
	case logrus.InfoLevel:
		colorCode = "\033[32m" // Green
	case logrus.WarnLevel:
		colorCode = "\033[33m" // Yellow
	case logrus.ErrorLevel:
		colorCode = "\033[31m" // Red
	case logrus.FatalLevel, logrus.PanicLevel:
		colorCode = "\033[1;31m" // Bold Red
	default:
		colorCode = "\033[0m" // Reset
	}

	// Apply color and reset
	colorizedBytes := append([]byte(colorCode), jsonBytes...)
	return append(colorizedBytes, []byte("\033[0m")...), nil
}

// NewColorizedJSONFormatter creates a new colorized formatter
func NewColorizedJSONFormatter() *ColorizedJSONFormatter {
	return &ColorizedJSONFormatter{
		PrettyJSONFormatter: NewPrettyJSONFormatter(),
		DisableColors:       false,
	}
}
