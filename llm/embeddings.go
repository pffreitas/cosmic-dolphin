package llm

import (
	"context"
	"fmt"

	"github.com/openai/openai-go"
	"github.com/openai/openai-go/shared"
	"github.com/pkoukk/tiktoken-go"
)

const MaxTokens = 8192
const ExpectedDimensions = 3072

type GenerateEmbeddingsResponse struct {
	Embeddings []float32
}

func GenerateEmbeddings(content string) ([]GenerateEmbeddingsResponse, error) {
	var openaiClient = openai.NewClient()

	encoding := "cl100k_base"

	tke, err := tiktoken.GetEncoding(encoding)
	if err != nil {
		err = fmt.Errorf("getEncoding: %v", err)
		return nil, err
	}

	tokens := tke.Encode(content, nil, nil)

	var chunks [][]int
	for i := 0; i < len(tokens); i += MaxTokens {
		end := i + MaxTokens
		if end > len(tokens) {
			end = len(tokens)
		}
		chunks = append(chunks, tokens[i:end])
	}

	var responses []GenerateEmbeddingsResponse

	for _, chunk := range chunks {
		input := tke.Decode(chunk)
		embeddings, err := openaiClient.Embeddings.New(context.Background(), openai.EmbeddingNewParams{
			Input: openai.F[openai.EmbeddingNewParamsInputUnion](shared.UnionString(input)),
			Model: openai.F(openai.EmbeddingModelTextEmbedding3Large),
		})
		if err != nil {
			return nil, err
		}

		embedding := embeddings.Data[0].Embedding
		if len(embedding) != ExpectedDimensions {
			return nil, fmt.Errorf("unexpected embedding dimensions: got %d, expected %d", len(embedding), ExpectedDimensions)
		}

		response := GenerateEmbeddingsResponse{
			Embeddings: make([]float32, len(embedding)),
		}
		for i, e := range embedding {
			response.Embeddings[i] = float32(e)
		}

		responses = append(responses, response)
	}

	return responses, nil
}
