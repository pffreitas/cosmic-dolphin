/**
 * The `file` phase's prompt.
 *
 * The model does not file anything and does not create anything. It answers a
 * three-way question — this existing collection, a proposal for a new one, or
 * nothing — and the service decides what that is worth. See
 * docs/functional-spec/03-ai-pipeline.md § Filing.
 *
 * The prompt is written so that `null` is an ordinary answer rather than a
 * failure to produce one. A model that believes it must always pick something
 * will always pick something, and a library filled by a model that had to guess
 * is worse than a library with an Inbox in it.
 */
export const FILE_BOOKMARK_PROMPT = `
You are filing one saved bookmark into a person's own collection tree.

## Their collection tree

{{COLLECTION_TREE}}

## The bookmark

**Title:** {{TITLE}}
**URL:** {{URL}}
**Summary:** {{SUMMARY}}
**Tags:** {{TAGS}}

## How to decide

Answer with exactly one of three things.

1. **An existing collection.** Strongly preferred. Return its id in
   \`existingCollectionId\` when the bookmark plainly belongs there. A collection
   that is roughly right is better than a new one that is exactly right.
2. **A proposal for a new collection**, in \`newCollection\`, as
   \`{ "name": string, "parentId": string | null }\`. Use this only when the
   subject is clearly recurring for this person and no existing collection
   covers it. \`parentId\` must be a top-level collection from the tree, or
   \`null\` for a top-level proposal — the tree is only ever two levels deep.
   You are proposing, not creating: nothing is created until the person agrees,
   and a proposal is only ever shown to them once several bookmarks support it.
3. **Nothing.** Return \`null\` for both fields. This is the right answer
   whenever the tree has no good home and the subject is not obviously
   recurring. The bookmark stays in the Inbox, which is a normal place for a
   bookmark to be and not a failure. Prefer this over a strained match and over
   a speculative new collection.

Rules:
- Never invent a collection id. Every id you return must appear in the tree above.
- Name a proposed collection the way this person names things: short, concrete,
  and in the vocabulary of their existing tree and tags.
- \`confidence\` is how sure you are of the answer you gave, from 0 to 1.

## Response format

Return a JSON object and nothing else:
{
  "existingCollectionId": string | null,
  "newCollection": { "name": string, "parentId": string | null } | null,
  "confidence": number,
  "reasoning": string
}

## Examples

Filing into an existing collection:
{
  "existingCollectionId": "3f1c…",
  "newCollection": null,
  "confidence": 0.92,
  "reasoning": "A Python web framework tutorial, and 'Programming > Python' already exists."
}

Proposing a new collection:
{
  "existingCollectionId": null,
  "newCollection": { "name": "Machine learning", "parentId": "9ab2…" },
  "confidence": 0.81,
  "reasoning": "Fourth ML paper this month and nothing under Technology covers it."
}

Leaving it in the Inbox:
{
  "existingCollectionId": null,
  "newCollection": null,
  "confidence": 0.4,
  "reasoning": "A one-off recipe. Nothing in the tree is close and one recipe is not a collection."
}

Now decide.
`;

export const buildCollectionTreeText = (
  collections: Array<{
    id: string;
    name: string;
    parentId: string | null;
  }>
): string => {
  if (collections.length === 0) {
    return "(This person has no collections yet.)";
  }

  const childrenMap = new Map<string | null, typeof collections>();
  for (const collection of collections) {
    const parentId = collection.parentId;
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, []);
    }
    childrenMap.get(parentId)!.push(collection);
  }

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

export const buildFilingPrompt = (params: {
  collectionTree: string;
  title: string;
  url: string;
  summary: string;
  tags: string[];
}): string => {
  return FILE_BOOKMARK_PROMPT.replace(
    "{{COLLECTION_TREE}}",
    params.collectionTree
  )
    .replace("{{TITLE}}", params.title || "Untitled")
    .replace("{{URL}}", params.url)
    .replace("{{SUMMARY}}", params.summary || "No summary available")
    .replace("{{TAGS}}", params.tags.length > 0 ? params.tags.join(", ") : "No tags");
};
