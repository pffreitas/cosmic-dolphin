package openai

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strings"

	"cosmic-dolphin/llm"
	"cosmic-dolphin/llm/client"

	"github.com/sashabaranov/go-openai"
	log "github.com/sirupsen/logrus"
)

type Client struct {
	client *openai.Client
}

func New(apiKey string) *Client {
	return &Client{
		client: openai.NewClient(apiKey),
	}
}

func NewClient(cl *openai.Client) *Client {
	return &Client{
		client: cl,
	}
}

func (Client) SupportsStreaming() bool {
	return true
}

var _ client.Client = (*Client)(nil)

func maybeWrapError(err error) error {
	e := &openai.APIError{}
	if errors.As(err, &e) && e.HTTPStatusCode == 429 || e.HTTPStatusCode == 500 {
		return client.Retryable(err)
	}
	return err

}

func (cl *Client) CreateChatCompletion(ctx context.Context, request client.ChatCompletionRequest) (client.ChatCompletionResponse, error) {
	req, err := TranslateRequest(request)
	if err != nil {
		return client.ChatCompletionResponse{}, err
	}
	if request.WantsStreaming() {
		return cl.createChatCompletionStream(ctx, req, request.Stream)
	}

	req.ResponseFormat = &openai.ChatCompletionResponseFormat{
		Type: openai.ChatCompletionResponseFormatTypeJSONSchema,
		JSONSchema: &openai.ChatCompletionResponseFormatJSONSchema{
			Name:   "chat_completion_response_format",
			Schema: request.ResponseFormat.Schema,
			Strict: true,
		},
	}

	resp, err := cl.client.CreateChatCompletion(ctx, req)
	if err != nil {
		return client.ChatCompletionResponse{}, maybeWrapError(err)
	}
	return TranslateResponse(resp), nil
}

func (cl *Client) createChatCompletionStream(ctx context.Context, req openai.ChatCompletionRequest, w io.Writer) (client.ChatCompletionResponse, error) {
	req.Stream = true

	log.WithFields(log.Fields{
		"request": fmt.Sprintf("%+v", req),
		"stream":  true,
	}).Debug("RespondStream: Sending request")
	stream, err := cl.client.CreateChatCompletionStream(ctx, req)
	if err != nil {
		return client.ChatCompletionResponse{}, err
	}

	defer stream.Close()

	var b strings.Builder

	for {
		r, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			break
		} else if err != nil {
			return client.ChatCompletionResponse{}, err
		}
		//logger.WithField("stream response", fmt.Sprintf("%+v", r)).Trace("Received response from OpenAI API")
		delta := r.Choices[0].Delta.Content
		if _, err := b.WriteString(delta); err != nil {
			return client.ChatCompletionResponse{}, err
		}
		if _, err := w.Write([]byte(delta)); err != nil {
			return client.ChatCompletionResponse{}, err
		}

	}
	w.Write([]byte("\n\n"))

	message := llm.Message{
		Content: b.String(),
		Role:    llm.Assistant,
	}

	return client.ChatCompletionResponse{Choices: []llm.Message{message}}, nil
}

var roleMapping = map[llm.Role]string{
	llm.User:      openai.ChatMessageRoleUser,
	llm.System:    openai.ChatMessageRoleSystem,
	llm.Assistant: openai.ChatMessageRoleAssistant,
}

func TranslateRequest(clientReq client.ChatCompletionRequest) (openai.ChatCompletionRequest, error) {
	req := openai.ChatCompletionRequest{
		Model:       clientReq.Model,
		Messages:    []openai.ChatCompletionMessage{},
		Temperature: clientReq.Temperature,
	}

	if topP, ok := clientReq.CustomParams["top_p"]; ok {
		req.TopP, ok = topP.(float32)
		if !ok {
			return openai.ChatCompletionRequest{}, fmt.Errorf("top_p must be a float32")
		}
	}

	if presencePenalty, ok := clientReq.CustomParams["presence_penalty"]; ok {
		req.PresencePenalty, ok = presencePenalty.(float32)
		if !ok {
			return openai.ChatCompletionRequest{}, fmt.Errorf("presence_penalty must be a float32")
		}
	}

	if frequencyPenalty, ok := clientReq.CustomParams["frequency_penalty"]; ok {
		req.FrequencyPenalty, ok = frequencyPenalty.(float32)
		if !ok {
			return openai.ChatCompletionRequest{}, fmt.Errorf("frequency_penalty must be a float32")
		}
	}

	if stop, ok := clientReq.CustomParams["stop"]; ok {
		req.Stop = stop.([]string)
	}

	if logitBias, ok := clientReq.CustomParams["logit_bias"]; ok {
		logitBiasMap, convOk := logitBias.(map[string]int)
		if !convOk {
			return openai.ChatCompletionRequest{}, fmt.Errorf("logit_bias must be a map[string]int")
		}
		req.LogitBias = logitBiasMap
	}

	// FIXME(ryszrd): rethink how should I handle n.
	if n, ok := clientReq.CustomParams["n"]; ok {
		req.N = n.(int)
	}

	if user, ok := clientReq.CustomParams["user"]; ok {
		req.User = user.(string)
	}

	for _, message := range clientReq.Messages {
		req.Messages = append(req.Messages, openai.ChatCompletionMessage{
			Content: message.Content,
			Role:    roleMapping[message.Role],
		})
	}

	return req, nil

}

// TranslateResponse translates a ChatCompletionResponse from the openai package to one from the client package
func TranslateResponse(openaiResp openai.ChatCompletionResponse) client.ChatCompletionResponse {
	// Create a new slice to hold the translated messages
	clientMessages := make([]llm.Message, len(openaiResp.Choices))

	// Loop over the choices in the openai response
	for i, choice := range openaiResp.Choices {
		// Translate each choice's message to the client's Message type
		clientMessages[i] = llm.Message{
			Content: choice.Message.Content,
			Role:    llm.Role(choice.Message.Role),
		}
	}

	// Return a new ChatCompletionResponse from the client package, using the translated messages
	return client.ChatCompletionResponse{
		Choices: clientMessages,
	}
}
