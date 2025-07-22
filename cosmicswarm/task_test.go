package cosmicswarm_test

import (
	"context"
	"cosmic-dolphin/config"
	"cosmic-dolphin/cosmicswarm"
	cosmicswarmLLM "cosmic-dolphin/cosmicswarm/llm"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"testing"
	"time"
)

type StreamChunk struct {
	Token string
	Done  bool
	Error error
}

type TestStreamHandler struct {
	ResponseChan chan StreamChunk
	Output       string
}

func (h *TestStreamHandler) OnStart() {
	h.Output = "Task Manager started\n"
}

func (h *TestStreamHandler) OnToken(token string) {
}

func (h *TestStreamHandler) OnComplete(message cosmicswarmLLM.Message) {
	h.ResponseChan <- StreamChunk{
		Done: true,
	}
}

func (h *TestStreamHandler) OnError(err error) {
	h.ResponseChan <- StreamChunk{
		Done:  true,
		Error: err,
	}
}

func (h *TestStreamHandler) OnLLMStart(messages []cosmicswarmLLM.Message) {
	h.Output += fmt.Sprintf(">>> Calling LLM with %d messages\n", len(messages))
	for i, message := range messages {
		h.Output += fmt.Sprintf("[%d] %s\n", i, message.Content)
	}
	h.Output += "--------------------------------\n"
}

func (h *TestStreamHandler) OnLLMResponse(message cosmicswarmLLM.Message) {
	h.Output += fmt.Sprintf("<<< LLM response: %s\n", message.Content)
	h.Output += "--------------------------------\n"
}

func (h *TestStreamHandler) OnToolCall(toolCall cosmicswarmLLM.LLMToolCall) {
	h.Output += fmt.Sprintf("Calling tool: %s\n", toolCall.Function.Name)
}

func (h *TestStreamHandler) OnToolCallArguments(toolCallID string, arguments string) {
}

func (h *TestStreamHandler) OnTokenUsage(usage cosmicswarmLLM.Usage) {
	h.Output += fmt.Sprintf("Token usage - Prompt: %d, Completion: %d, Total: %d\n",
		usage.PromptTokens, usage.CompletionTokens, usage.TotalTokens)
}

func (h *TestStreamHandler) OnTaskStart(task *cosmicswarm.Task) {
	h.Output += fmt.Sprintf("Task started: %s\n", task.ID)
}

func (h *TestStreamHandler) OnTaskComplete(task *cosmicswarm.Task) {
	h.Output += fmt.Sprintf("Task complete: %s\n", task.ID)
}

func (h *TestStreamHandler) OnTaskError(task *cosmicswarm.Task, err error) {
	h.Output += fmt.Sprintf("Task error: %s\n", err.Error())
}

func (h *TestStreamHandler) OnTaskMessage(task *cosmicswarm.Task, message cosmicswarmLLM.Message) {
	h.Output += fmt.Sprintf("Task message: %s\n", message.Content)
	for _, toolCall := range message.ToolCalls {
		h.Output += fmt.Sprintf("Task tool call: %s\n", toolCall.Function.Name)
		h.Output += fmt.Sprintf("Task tool call arguments: %s\n", string(toolCall.Function.Arguments))
	}
}

func (h *TestStreamHandler) OnNextStep(task *cosmicswarm.Task, message cosmicswarmLLM.Message) {
	h.Output += fmt.Sprintf("Next step for task %s: %s\n", task.ID, message.Content)
}

func TestTask(t *testing.T) {
	config.LoadEnv("../.dev.env")

	streamHandler := TestStreamHandler{
		ResponseChan: make(chan StreamChunk),
	}

	taskManager, err := cosmicswarm.NewTaskManager(config.GetConfig(config.OpenAIKey), cosmicswarmLLM.OpenAI, &streamHandler)
	if err != nil {
		t.Fatalf("Failed to create task manager: %v", err)
	}

	taskManager.AddTask(&cosmicswarm.Task{
		ID: "cosmic_images",
		Instructions: `
		You are given a content that contains images URLs.
		Based on the content, you must determine the images that most relate to the content and are relevant to the understanding of the content.
		You must skip images that are not relevant to the content such as logos, icons, avatars, advertisements, etc.

		1. For each image you must gather the following information and call the 'encode_image' function:
		- image_url: The url of the image
		- image_description: The description of the image
		- image_relevance: The relevance of the image to the content (1-10)
		- image_context: Explanation of how the image is connected to the content. Read the content to understand the reference to the image. The context must be a summary of the image and how it relates to the content. You must deterime how this image is used to illustrate the content.

		2. After you have gathered the information for each image and called 'encode_image', you must create a meticulous description of the image, like you are describing it to a blind person.

		3. With the results of the 'encode_image' function and the description of the image, you must call the 'store_image' function for each of the images that are relevant to the content with the following parameters:
		- image_url: The url of the image
		- image_description: The description of the image
		- image_relevance: The relevance of the image to the content (1-10)
		- image_context: Explanation of how the image is connected to the content. Read the content to understand the reference to the image. The context must be a summary of the image and how it relates to the content. You must deterime how this image is used to illustrate the content.
		`,
		Tools: []cosmicswarm.TaskTool{
			{
				ToolDef: cosmicswarmLLM.ToolDef{
					Type: "function",
					Function: &cosmicswarmLLM.ToolFunctionDef{
						Name:        "store_image",
						Description: "Store the image in the database",
						Parameters: map[string]any{
							"type": "object",
							"properties": map[string]any{
								"image_url": map[string]any{
									"type":        "string",
									"description": "The url of the image to process",
								},
								"image_description": map[string]any{
									"type":        "string",
									"description": "The meticulous description of the image (like you are describing it to a blind person)",
								},
								"image_context": map[string]any{
									"type":        "string",
									"description": "A summary of how the image relates to the content (1-10)",
								},
							},
						},
					},
				},
				Run: func(args map[string]any, taskExecutionContext *cosmicswarm.TaskExecutionContext) *cosmicswarm.TaskResult {
					url := args["image_url"]
					description := args["image_description"]
					context := args["image_context"]

					taskResult := cosmicswarm.TaskResult{
						Response: fmt.Sprintf("Successfully processed resource from url: %s, description: %s, context: %s", url, description, context),
						Variables: map[string]interface{}{
							"image_url":         url,
							"image_description": description,
							"image_context":     context,
						},
					}

					return &taskResult
				},
			},
			{
				ToolDef: cosmicswarmLLM.ToolDef{
					Type: "function",
					Function: &cosmicswarmLLM.ToolFunctionDef{
						Name:        "encode_image",
						Description: "Encode the image into a base64 string",
						Parameters: map[string]any{
							"type": "object",
							"properties": map[string]any{
								"image_url": map[string]any{
									"type":        "string",
									"description": "The url of the image to process",
								},
							},
						},
					},
				},
				Run: func(args map[string]any, taskExecutionContext *cosmicswarm.TaskExecutionContext) *cosmicswarm.TaskResult {
					url, ok := args["image_url"]
					if !ok {
						return &cosmicswarm.TaskResult{
							Response: "Error: url is not set",
							Error:    fmt.Errorf("url is not set"),
						}
					}

					urlString, ok := url.(string)
					if !ok {
						return &cosmicswarm.TaskResult{
							Response: "Error: url is not a string",
							Error:    fmt.Errorf("url is not a string"),
						}
					}

					// Download the image
					response, err := http.Get(urlString)
					if err != nil {
						return &cosmicswarm.TaskResult{
							Response: "Error: failed to download image",
							Error:    fmt.Errorf("failed to download image: %v", err),
						}
					}

					// Read the image
					image, err := io.ReadAll(response.Body)
					if err != nil {
						return &cosmicswarm.TaskResult{
							Response: "Error: failed to read image",
							Error:    fmt.Errorf("failed to read image: %v", err),
						}
					}

					// Encode the image
					encodedImage := base64.StdEncoding.EncodeToString(image)

					taskResult := cosmicswarm.TaskResult{
						Response: fmt.Sprintf("Successfully encoded image from url: %s", url),
						Variables: map[string]interface{}{
							"encoded_image": encodedImage,
						},
					}

					return &taskResult
				},
			},
		},
	})

	go func() {
		defer close(streamHandler.ResponseChan)

		contextVariables := map[string]interface{}{}

		message := cosmicswarmLLM.Message{
			Role:    cosmicswarmLLM.RoleUser,
			Content: CONTENT,
		}

		taskManager.Execute(context.Background(), cosmicswarm.NewTaskExecutionContext([]cosmicswarmLLM.Message{message}, contextVariables))
	}()

	for {
		select {
		case response := <-streamHandler.ResponseChan:
			if response.Done {
				fmt.Println(streamHandler.Output)
				return
			}

			if response.Error != nil {
				fmt.Println(response.Error)
				t.Fatalf("Error: %v", response.Error)
				return
			}
		case <-time.After(5 * time.Minute):
			return
		}
	}
}

var CONTENT = `
<div class="entry-content" itemprop="articleBody">

		
<p>AI and Large Language Models (LLMs) have entered our lives and jobs in the last few years, helping us simplify and automate tasks and processes.</p>



<p>For IT professionals, AI is helping streamline workloads, speed up development cycles, implement new features faster, and reduce bugs and errors. But this is not all that AI can do for us.</p>



<p>Managing technical debt is a task that requires time and effort from developers, architects, and managers, but it is also a task where AI can be of great help.</p>



<p>In this article, you will learn:</p>



<ul class="wp-block-list">
<li>What technical debt is.</li>



<li>How AI can help you reduce technical debt.</li>



<li>Abilities and frameworks that can help you manage your technical debt.</li>



<li>Challenges and limitations of using AI to reduce technical debt.</li>
</ul>



<p>Let’s dive into it!</p>



<h2 class="wp-block-heading" id="what-is-technical-debt">What is Technical Debt?</h2>



<figure class="wp-block-image aligncenter size-large"><img loading="lazy" decoding="async" width="1056" height="255" src="https://semaphore.io/wp-content/uploads/2025/04/technical_debt-1056x255.png" alt="" class="wp-image-26364" srcset="https://semaphore.io/wp-content/uploads/2025/04/technical_debt-1056x255.png 1056w, https://semaphore.io/wp-content/uploads/2025/04/technical_debt-784x189.png 784w, https://semaphore.io/wp-content/uploads/2025/04/technical_debt-768x185.png 768w, https://semaphore.io/wp-content/uploads/2025/04/technical_debt-1536x371.png 1536w, https://semaphore.io/wp-content/uploads/2025/04/technical_debt-165x40.png 165w, https://semaphore.io/wp-content/uploads/2025/04/technical_debt.png 1839w" sizes="auto, (max-width: 1056px) 100vw, 1056px"></figure>



<p>Technical debt refers to the cost incurred when choosing short-term solutions over long-term ones. It happens when we make quick fixes instead of investing more time and resources in improving the overall project we are working on.</p>



<p>There are different types of technical debt. Or, more precisely, technical debt comes with different costs, which can be classified at a high level as follows:</p>



<ul class="wp-block-list">
<li><strong>Code debt</strong>: This type of technical debt occurs when you write code without considering its maintainability, readability, and scalability. Typical examples include spaghetti code, lack of modularity, hardcoded values, or insufficient use of design patterns. Many times, even if you wrote excellent code for this particular feature/problem set, the business moves on (think of a bug report which is actually a feature request) but the code did not.&nbsp;<em>sigh</em></li>



<li><strong>Documentation debt</strong>: Let’s be honest: this is one of the most common forms of technical debt. It occurs when documentation for code, APIs, systems, or processes is missing, outdated, or incomplete, making it difficult for others to understand and contribute effectively to a project they don’t know much about. And even though it’s “easier” (less time intensive) to write docs, you’re always better off writing test cases (which at least have a chance of letting you know if/when the business has moved on but your code has not).</li>



<li><strong>Testing debt</strong>: When you skip writing tests or fail to maintain existing test suites, you create testing debt. This leads to increased risk during software releases and makes it harder to identify and fix issues promptly. Insufficient or missing automated&nbsp;<a href="https://semaphoreci.com/blog/unit-testing-vs-integration-testing">tests</a>&nbsp;lead to poor test coverage and increased risk of bugs.</li>



<li><strong>Architecture debt</strong>: This form of technical debt occurs when architectural decisions made early in the project lifecycle lead to suboptimal designs that become increasingly challenging to modify or extend over time. Common cases include monolithic systems that should be modularized, poor database design, or lack of microservices where appropriate.</li>



<li><strong>Infrastructure debt</strong>: This kind of debt arises when infrastructure components such as servers, databases, networks, or cloud services are not properly designed, maintained, or scaled to meet evolving needs. Common scenarios include manual deployment processes, lack of CI/CD pipelines, or reliance on legacy hardware.</li>



<li><strong>Security debt</strong>: Security debt is arguably the most dangerous kind of technical debt because it can lead to serious consequences if left unaddressed. It results from neglecting security best practices, inadequate threat modeling, or failing to implement proper access controls and data protection measures. This can expose sensitive information and compromise system integrity.</li>
</ul>



<p>If you’ve ever worked on a legacy codebase or an old project, you know what technical debt means—and I know you don’t like it at all.</p>



<p>However, if you want to be completely honest, you have to admit that every line of code you write is potentially technical debt. You’d like that line of code to stay there as it is forever, but the reality is that it won’t happen. So why not&nbsp;<a href="https://semaphore.io/blog/do-you-need-to-test-everything">test it now</a>? Why not create living tests immediately? These tests not only ensure your code works as expected but also serve as the best form of documentation for future developers who will work on this codebase.</p>



<p>Well, the speed of development processes today is so important that we often find ourselves in situations where we need to deliver something quickly and efficiently. Sometimes, this means sacrificing some quality aspects of our codebase, unfortunately. However, this doesn’t mean that we shouldn’t try to minimize these sacrifices and keep our codebase healthy and well-maintained. The impact of technical debt can be severe in the long run, affecting companies in different areas, such as:</p>



<ul class="wp-block-list">
<li><strong>Reduced development speed</strong>: Today, you’re running fast to deliver new features while accumulating technical debt because you don’t document your code and have low test coverage. Tomorrow, you’ll spend hours debugging problems caused by your previous actions and lose precious time trying to figure out how things work again. This will slow down the development of new functionalities as you’ll need to work around existing issues, such as messy code, poor architecture, or lack of automation.</li>



<li><strong>Increased maintenance costs</strong>: As mentioned before, technical debt increases the complexity of maintaining and updating the codebase. This can result in higher ongoing expenses due to longer development cycles, more frequent bug fixes, and potential rework required to address underlying issues.</li>



<li><strong>Decreased product quality</strong>: Technical debt often results in more bugs, performance issues, and system failures, which can degrade the overall quality of the product. This can also mean that users may encounter unexpected behavior or crashes, leading to negative user experiences, decreased customer satisfaction, and an increase in support tickets.</li>



<li><strong>Delayed time-to-market</strong>: The longer it takes to develop and release new features, the slower your company can respond to market demands and capitalize on opportunities. This delay can put you at a competitive disadvantage compared to competitors who invest in continuous improvement and innovation.</li>



<li><strong>Increased risk of security breaches</strong>: Poorly managed technical debt can introduce vulnerabilities and security risks into your application. If attackers exploit these weaknesses, they could gain unauthorized access to sensitive data, disrupt operations, or cause financial losses.</li>
</ul>



<h2 class="wp-block-heading" id="how-ai-can-help-reduce-technical-debt">How AI Can Help Reduce Technical Debt</h2>



<figure class="wp-block-image aligncenter size-large"><img loading="lazy" decoding="async" width="1056" height="552" src="https://semaphore.io/wp-content/uploads/2025/04/ai_assistance-1056x552.png" alt="" class="wp-image-26365" srcset="https://semaphore.io/wp-content/uploads/2025/04/ai_assistance-1056x552.png 1056w, https://semaphore.io/wp-content/uploads/2025/04/ai_assistance-784x410.png 784w, https://semaphore.io/wp-content/uploads/2025/04/ai_assistance-768x401.png 768w, https://semaphore.io/wp-content/uploads/2025/04/ai_assistance-1536x803.png 1536w, https://semaphore.io/wp-content/uploads/2025/04/ai_assistance-165x86.png 165w, https://semaphore.io/wp-content/uploads/2025/04/ai_assistance.png 1862w" sizes="auto, (max-width: 1056px) 100vw, 1056px"></figure>



<p>The major difficulty of managing technical debt is that it is created daily with every line of code, so it requires a continuous effort to monitor and improve the codebase. This means you should have a process that constantly reviews and refactors code, updates documentation, adds and improves tests, verifies that security has been managed to address new issues, and ensures that everything works smoothly together.</p>



<p>It’s hard, I know.</p>



<p>The good news is that AI can help you reduce technical debt. In particular, AI coding assistants can be integrated into your workflow and help you reduce technical debt by operating in the following areas:</p>



<ul class="wp-block-list">
<li><strong>Code analysis and refactoring</strong>: AI-powered abilities can analyze your codebase and provide suggestions for improvements, such as identifying unused variables, optimizing algorithms, or suggesting better naming conventions. These recommendations can help you clean up your code and eliminate unnecessary technical debt.</li>



<li><strong>Automated testing</strong>: AI assistants can generate test cases based on your codebase, ensuring comprehensive coverage across various scenarios. This saves time and effort while minimizing the risk of introducing new defects through manual testing.</li>



<li><strong>Documentation generation</strong>: AI assistants can create technical documentation by extracting information from your code comments and source files. A typical example is the generation of documentation for functions, classes, or modules.</li>



<li><strong>Security assessment</strong>: Some AI abilities (like&nbsp;<a href="https://snyk.io/platform/deepcode-ai/">DeepCode – now part of Snyk</a>) are specifically designed to scan your codebase for potential security vulnerabilities and suggest remediation strategies. This way, you can mitigate the risk associated with technical debt related to insecure coding practices, including detecting outdated or vulnerable dependencies.</li>
</ul>



<p>In other words, AI can help you reduce technical debt in real time by integrating AI coding assistants into your workflows. This is revolutionary because it allows you to catch technical debt as soon as possible and prevent it from becoming a bigger problem later on.</p>



<h2 class="wp-block-heading" id="tools-for-ai-driven-technical-debt-reduction">Tools for AI-Driven Technical Debt Reduction</h2>



<p><a href="https://semaphore.io/blog/ai-coding-assistants">In a recent post</a>, we reviewed the best AI coding assistants for 2025.</p>



<p>This is the chance to expand more this list to give you more options to choose your AI coding assistant to help you reduce technical debt:</p>



<ul class="wp-block-list">
<li><strong>Cline</strong>: Powered by&nbsp;<a href="https://assets.anthropic.com/m/785e231869ea8b3b/original/claude-3-7-sonnet-system-card.pdf">Claude 3.7 Sonnet’s agentic coding capabilities</a>,&nbsp;<a href="https://github.com/cline/cline">Cline</a>&nbsp;is an AI assistant designed to operate within IDEs, assisting you with software development tasks. Now able to use “dynamic thinking”, start your conversation off with the assistant in “Plan” mode and, once satisfied with the course of action, switch over to “Act”. It will then autonomously generate and edit code, execute terminal commands, and browse the web, all while requiring user permission for each action. Learn how it works&nbsp;<a href="https://www.youtube.com/watch?v=hqc-S4_tIck">here</a>.</li>



<li><strong>Tabby</strong>:&nbsp;<a href="https://tabby.tabbyml.com/docs/welcome/">Tabby</a>&nbsp;is an open-source, self-hosted AI coding assistant, compatible with major coding LLMs like&nbsp;<a href="https://ollama.com/library/codellama">CodeLlama</a>,&nbsp;<a href="https://ollama.com/library/starcoder">StarCoder</a>, and&nbsp;<a href="https://docs.codegen.com/introduction/overview">CodeGen</a>. Its code completion engine is designed to understand your coding context and provide real-time suggestions that are accurate and relevant. As an open-source solution, it ensures software supply chain safety, giving you peace of mind. Learn how it works&nbsp;<a href="https://www.youtube.com/watch?v=8lc5jGwIqRo">here</a>.</li>



<li><strong>Cursor</strong>:&nbsp;<a href="https://www.cursor.com/features">Cursor</a>&nbsp;is an AI-powered coding assistant with the primary goal of streamlining the coding process and improving overall code quality. It integrates seamlessly with IDEs, provides a chat that lets you talk with an AI that sees your codebase, and can get up-to-date information from the internet. Learn how it works&nbsp;<a href="https://www.youtube.com/watch?v=ocMOZpuAMw4">here</a>.</li>



<li><strong>Codiga</strong>:&nbsp;<a href="https://www.codiga.io/">Codiga</a>&nbsp;is an AI-powered coding assistant and static code analysis ability designed to help developers write cleaner and safer code. One of its most appreciated features is its ability to perform real-time static code analysis, continuously checking for bugs, security vulnerabilities, and inefficiencies as you write code. Learn more about Codiga&nbsp;<a href="https://www.youtube.com/watch?v=hwB-fWdJ2Rw&amp;t=122s">here</a>.</li>



<li><strong>IntelliCode</strong>:&nbsp;<a href="https://visualstudio.microsoft.com/services/intellicode/">IntelliCode</a>, developed by Microsoft, is an AI-assisted code completion ability built into Visual Studio and Visual Studio Code. Its underlying LLM is trained on thousands of high-quality repositories from GitHub with high star ratings, allowing it to provide recommendations based on best practices and common patterns observed across the development community. Learn more&nbsp;<a href="https://www.youtube.com/watch?v=Nr3yCXxleFc">here</a>.</li>
</ul>



<h2 class="wp-block-heading" id="challenges-and-limitations-of-using-ai-for-technical-debt">Challenges and Limitations of Using AI for Technical Debt</h2>



<p>As you’ve learned throughout this article, AI offers significant advantages in managing technical debt. However, it doesn’t come without challenges and limitations.</p>



<p>Understanding these can help you make informed decisions when integrating AI into your workflows.</p>



<h3 class="wp-block-heading" id="accuracy-and-reliability-of-ai-models">Accuracy and Reliability of AI Models</h3>



<p>First of all, you have to face the truth: AI models are not infallible. They can produce false positives or negatives during code analysis, flagging issues that don’t exist or missing critical problems entirely. Additionally, AI often struggles to fully understand the context of your codebase, especially in complex or domain-specific projects and this can lead to suggestions that are irrelevant or even counterproductive, requiring careful review by developers.</p>



<p>So, your critical skills are still invaluable. You can’t just turn off your brain and let AI do everything for you. You have to evaluate the suggestions provided by AI and decide whether they are useful or not.</p>



<h3 class="wp-block-heading" id="integration-with-existing-workflows">Integration with Existing Workflows</h3>



<p>Integrating new tools or processes into already existing workflows is not always easy, and this also applies to AI coding assistants.</p>



<p>So, ensuring seamless integration between AI and your (and your team’s) current abilities, processes, and team dynamics requires time and effort. Moreover, while automation can save time, it’s essential to strike a balance between relying on AI and maintaining human oversight to ensure quality and alignment with project goals so that you are still in charge of your project objectives, meaning: you don’t just blindly delegate everything to AI.</p>



<h3 class="wp-block-heading" id="ethical-and-security-considerations">Ethical and Security Considerations</h3>



<p>AI-generated code must be carefully reviewed to ensure it adheres to security best practices. While some AI coding assistants are specifically crafted with security in mind, not all of them provide a high level of security when offering suggestions. So, overlooking this step can introduce vulnerabilities into your system, potentially leading to serious consequences.</p>



<p>Additionally, over-reliance on AI can create a dependency that may hinder your team’s ability to solve problems independently or innovate effectively — and this is another reason why you should never rely solely on AI for decision-making.</p>



<h2 class="wp-block-heading" id="conclusion">Conclusion</h2>



<p>In this article, you’ve learned how AI can help you reduce technical debt. You’ve seen how AI coding assistants can assist you in analyzing your codebase, generating tests, creating documentation, assessing security, and more. You’ve also explored the benefits of integrating AI into your workflows and discussed the importance of balancing automation with human oversight.</p>



<p>However, remember that AI is not a magic wand that solves all your problems. It requires careful consideration and implementation to achieve optimal results. In other words: your skills are still needed and highly valuable.</p>


	</div>
`
