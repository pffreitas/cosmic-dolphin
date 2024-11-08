package llm

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
