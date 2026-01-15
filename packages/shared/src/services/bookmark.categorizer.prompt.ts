export const CATEGORIZE_BOOKMARK_PROMPT = `
You are a bookmark categorization assistant. Your task is to analyze a bookmark and determine the most appropriate category from an existing category tree, or suggest a new category path if none match well.

## Existing Category Tree

{{CATEGORY_TREE}}

## Bookmark Information

**Title:** {{TITLE}}
**URL:** {{URL}}
**Summary:** {{SUMMARY}}
**Tags:** {{TAGS}}

## Instructions

1. Analyze the bookmark's content, title, URL domain, and tags to understand its topic.
2. Compare the bookmark against the existing category tree.
3. If an existing category matches the bookmark with high confidence (>= 0.7):
   - Return the category ID
   - Provide your confidence score (0.0 to 1.0)
4. If no existing category matches well (confidence < 0.7):
   - Suggest a new category path (array of category names from root to leaf)
   - The path should be hierarchical (e.g., ["Technology", "Programming", "Python"])
   - Keep paths 1-3 levels deep
   - Use clear, concise category names

## Response Format

You must respond with a valid JSON object following this exact schema:
{
  "existingCategoryId": string | null,  // ID of matching category, or null if suggesting new
  "newCategoryPath": string[] | null,   // Path for new category, or null if using existing
  "confidence": number,                  // Confidence score between 0.0 and 1.0
  "reasoning": string                    // Brief explanation of your decision
}

## Examples

**Example 1 - Matching existing category:**
{
  "existingCategoryId": "abc-123",
  "newCategoryPath": null,
  "confidence": 0.92,
  "reasoning": "The bookmark is about Python web frameworks, which clearly fits under the existing 'Programming > Python' category."
}

**Example 2 - Suggesting new category:**
{
  "existingCategoryId": null,
  "newCategoryPath": ["Technology", "AI", "Machine Learning"],
  "confidence": 0.85,
  "reasoning": "The bookmark covers machine learning topics. No existing AI category exists, so creating a new path under Technology."
}

**Example 3 - No categories exist yet:**
{
  "existingCategoryId": null,
  "newCategoryPath": ["Development", "Web Development"],
  "confidence": 0.88,
  "reasoning": "This is a web development tutorial. Starting a new category tree for development topics."
}

Now analyze the bookmark and provide your categorization decision.
`;

export const buildCategoryTreeText = (
  categories: Array<{
    id: string;
    name: string;
    parentId: string | null;
  }>
): string => {
  if (categories.length === 0) {
    return "(No categories exist yet - you should suggest a new category path)";
  }

  // Build a map of parent -> children
  const childrenMap = new Map<string | null, typeof categories>();
  for (const cat of categories) {
    const parentId = cat.parentId;
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, []);
    }
    childrenMap.get(parentId)!.push(cat);
  }

  // Recursively build the tree text
  const buildTreeRecursive = (
    parentId: string | null,
    indent: number
  ): string => {
    const children = childrenMap.get(parentId) || [];
    let result = "";
    for (const child of children) {
      const indentStr = "  ".repeat(indent);
      result += `${indentStr}- ${child.name} (id: ${child.id})\n`;
      result += buildTreeRecursive(child.id, indent + 1);
    }
    return result;
  };

  return buildTreeRecursive(null, 0);
};

export const buildCategorizationPrompt = (params: {
  categoryTree: string;
  title: string;
  url: string;
  summary: string;
  tags: string[];
}): string => {
  return CATEGORIZE_BOOKMARK_PROMPT.replace("{{CATEGORY_TREE}}", params.categoryTree)
    .replace("{{TITLE}}", params.title || "Untitled")
    .replace("{{URL}}", params.url)
    .replace("{{SUMMARY}}", params.summary || "No summary available")
    .replace("{{TAGS}}", params.tags.length > 0 ? params.tags.join(", ") : "No tags");
};
