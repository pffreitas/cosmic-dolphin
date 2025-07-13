package llm

type LLMToken struct {
	Event string `json:"event"`
	Data  string `json:"data"`
	Done  bool   `json:"done"`
}
