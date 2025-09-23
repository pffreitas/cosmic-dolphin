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
Your task is to generate the summary for the content. Follow the instructions below step by step:

1. Read and analyze the following content:

<content>
{{CONTENT}}
</content>

2. Create a summary with the following sections:

- Title: A concise, descriptive title for the content
- Summary: A brief overview of the main ideas (2-3 sentences)
- Key Points: 3-5 bullet points highlighting the most important information
- Takeaways: 2-3 main lessons or insights from the content
- Practical Applications: 3 ways this knowledge can be applied in real-world situations
- Follow-up Links: Identify a maximum of 3 links within the content that are extremely relevant to the main article and highlight them as follow-up links.

3. Format the output as follows:
You must ouput in markdown format. You MUST NOT include any other text than the markdown text. Like this:

    ## [Title]

    [Summary]

    ## Key Points

    [Bullet points]

    ## Takeaways

    [Bullet points]

    ## Practical Applications

    [Numbered list]

    ## Follow-up Links

    [Numbered list of links to follow up with explanations]


## Important requirements:
- Use markdown format for the summary content.
- Do not include any text other than the markdown output.
- Do not enclose the output in '''markdown''' blocks.
- Do not enclose the output in '''json''' blocks.
`;

export const FILTER_IMAGES_PROMPT = `
Your task is to filter the images that are not relevant to the content. Follow the instructions below step by step:

1. Read and analyze the following content:
<content>
{{CONTENT}}
</content>

2. Filter the images that are not relevant to the content.

3. For each image, provide a brief explanation (1-2 sentences) of why it's relevant and how it relates to the main content. 
Do not consider hero images.
Keep the image url and place the relevant analysis in thealt text in the output.

4. Format the output as follows:
You must ouput a json object following the schema below. You MUST NOT include any other text than the json object. Your output MUST be a valid json object following the schema below
{
    "images": [
        {
            "url": "string",
            "alt": "string"
        }
    ]
}
`;
