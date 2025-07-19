package cosmicdolphin

type Role string

const (
	System    Role = "system"
	User      Role = "user"
	Assistant Role = "assistant"
)

type Message struct {
	Content string `json:"content"`
	Role    Role   `json:"role"`
}

type LLMToken struct {
	Event string `json:"event"`
	Data  string `json:"data"`
	Done  bool   `json:"done"`
}
