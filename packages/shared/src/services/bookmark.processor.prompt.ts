export const GENERATE_METADATA_PROMPT = `
Your task is to generate the metadata for the content. Follow the instructions below step by step:

1. Read and analyze the following content:
<content>
{{CONTENT}}
</content>

2. Generate the following metadata for the content:
- Title: The same title used in the summary
- Summary: A condensed version of the summary section (1-2 sentences)
- Tags: 3-5 relevant keywords or phrases
- Links: For each link in the content execute an analysis like described in step 3.
- Images: For each <img> tag (or image reference in markdown) in the content execute an analysis like described in step 4.


3. Analyze ALL links:
- You must analyze **ALL** the links in the content and provide a context for each link.
- You must include all links relevant to the content in the output.
- For each link, provide a brief explanation (1-2 sentences) of why it's relevant and how it relates to the main content

4. Analyze ALL images and provide context:
- you must analyze **ALL** the images in the content and provide a context for each image.
- For each image in the content:
- Explain the concept illustrated in the image
- Provide context that links the image to the main article
- Keep a reference to the image url in the output, like this: ![image description](image_url)

5. Format the output as follows:
You must ouput a json object with the following properties:
    - title: [string]
    - summary: [string]
    - tags: [array of strings]
    - link_analysis: [array of objects with 'url' and 'relevance' properties]
    - image_analysis: [array of objects with 'url', 'alt', and 'description' properties]

6. Call the 'parse_metadata' function with the following parameters:
- metadata:	the json object with the metadata
    - title: The title string
    - summary: The summary string
    - tags: The array of tag strings
    - image_analysis: The array of image objects with 'url', 'alt', and 'description' properties
    - link_analysis: The array of link objects

`;

export const GENERATE_IMAGES_METADATA_PROMPT = `
Follow the instructions below step by step:

1. Read and analyze the following content:
<content>
{{CONTENT}}
</content>

2. Generate the following metadata for the content:
- Images: For each <img> tag (or image reference in markdown) in the content execute an analysis following the instructions below:
    - you must analyze **ALL** the images in the content and provide a context for each image.
    - For each image in the content:
        - Explain the concept illustrated in the image
        - Provide context that links the image to the main article
        - Keep a reference to the image url in the output, like this: ![image description](image_url)

3. Format the output as follows:
You must ouput a json object following the schema below. You MUST NOT include any other text than the json object. Your output MUST be a valid json object following the schema below
{{OUTPUT_SCHEMA}}
`;

export const GENERATE_TAGS_PROMPT = `
Your task is to generate the tags for the content. Follow the instructions below step by step:

1. Read and analyze the following content:

<content>
{{CONTENT}}
</content>

2. Generate the following metadata for the content:
- Tags: 3-5 relevant keywords or phrases

3. Format the output as follows:
You must ouput a json object following the schema below. You MUST NOT include any other text than the json object. Your output MUST be a valid json object following the schema below
{
    "tags": [string]
}
`;

export const GENERATE_TITLE_PROMPT = `
Your task is to generate the title for the content. Follow the instructions below step by step:

1. Read and analyze the following content:

<content>
{{CONTENT}}
</content>
`;

export const SUMMARIZE_PROMPT = `
You will be creating a comprehensive summary of provided content. Follow these instructions carefully:

<content>
{{CONTENT}}
</content>

Your task is to analyze the above content and create a structured summary following these steps:

1. **Read and Analyze**: Carefully read through the entire content to understand the main themes, key concepts, and overall message.

2. **Identify Core Elements**: Determine what specific elements are central to the content (e.g., if it's about "5 Design Patterns," ensure all 5 patterns are captured; if it's about a process, capture all steps).

3. **Create Summary Sections**: Generate the following required sections:
   - **Title**: Create a concise, descriptive title that captures the essence of the content
   - **Summary**: Write 2-3 sentences providing a brief overview of the main ideas
   - **Key Points**: List 3-5 bullet points highlighting the most important information
   - **Takeaways**: Identify 2-3 main lessons or insights from the content
   - **Practical Applications**: List 3 numbered ways this knowledge can be applied in real-world situations
   - **Follow-up Links**: Find up to 3 links within the content that are extremely relevant to the main topic and list them with brief explanations

4. **Add Content-Specific Sections**: Based on your analysis, include additional sections that are relevant to the main message. For example:
   - If the content covers multiple frameworks, create a section listing them
   - If there are sequential steps or processes, create a section outlining them
   - If there are categories or types being discussed, organize them appropriately
   - Use tables or lists when they would present the information more clearly

5. **Format Requirements**:
   - Output ONLY in markdown format
   - Do NOT include any text other than the markdown content
   - Do NOT wrap the output in code blocks ('''markdown''' or '''json'''')
   - Use ## for main section headers
   - Use bullet points (-) for Key Points and Takeaways
   - Use numbered lists (1., 2., 3.) for Practical Applications and Follow-up Links

Your output should follow this structure:

## [Title]

[Summary paragraph]

## Key Points

- [Point 1]
- [Point 2]
- [Point 3]

## Takeaways

- [Takeaway 1]
- [Takeaway 2]

## Practical Applications

1. [Application 1]
2. [Application 2]
3. [Application 3]

## Follow-up Links

1. [Link 1 with explanation]
2. [Link 2 with explanation]
3. [Link 3 with explanation]

## [Any Additional Content-Specific Sections]

[Relevant content organized appropriately]

Begin your response immediately with the markdown content.
`;

export const BRIEF_SUMMARY_PROMPT = `
Your task is to generate a compelling brief summary that helps users decide if they want to read the full content.

1. Read and analyze the following content:

<content>
{{CONTENT}}
</content>

2. Generate a brief summary following these guidelines:

**Purpose:** Create a preview that hooks the reader and highlights the value proposition of the content.

**Requirements:**
- Length: 2-4 sentences (approximately 50-100 words)
- Tone: Engaging, informative, and compelling
- Content: Include the key takeaway and why it matters to the reader

**What to include:**
- The main topic or problem being addressed
- The key insight, solution, or value the content provides
- Why this is relevant or useful to the reader

**What to avoid:**
- Generic phrases like "This article discusses..." or "In this post..."
- Overly technical jargon unless essential
- Spoiling all the details (leave something to discover)

3. Output ONLY the summary text. Do NOT include any labels, prefixes, or formatting. Just the plain summary paragraph.
`;

export const FILTER_IMAGES_PROMPT = `
Your task is to filter the images that are not relevant to the content. Follow the instructions below step by step:

1. Read and analyze the following content:
<content>
{{CONTENT}}
</content>

2. Filter the images that are not relevant to the content.

3. For each image, provide a title and explanation (1-2 sentences) of why it's relevant and how it relates to the main content. The description must be a complete description of the image and how it relates to the main content.
You must ignore hero images.
You must ignore ads.
You must ignore author avatar images.
You must ignore images that are not relevant to the content.

4. Format the output as follows:
You must ouput a json object following the schema below. You MUST NOT include any other text than the json object. Your output MUST be a valid json object following the schema below
{
    "images": [
        {
            "url": "string",
            "title": "string",
            "description": "string"
        }
    ]
}
`;
