export const generateMetadataPrompt = `
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
    - image_analysis: [array of objects with 'alt' and 'description' properties]

6. Call the 'update_note' function with the following parameters:
- metadata:	the json object with the metadata
    - title: The title string
    - summary: The summary string
    - tags: The array of tag strings
    - image_analysis: The array of image objects
    - link_analysis: The array of link objects

`;
