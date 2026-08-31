/**
 * The digest prompt.
 *
 * The model is not asked to find a pattern. The pattern has already been
 * measured — the cluster reached this prompt only because its mean pairwise
 * embedding similarity cleared a threshold — and the model is asked to *state*
 * it, or to say that it cannot.
 *
 * That refusal is the load-bearing instruction here. A model told to summarise
 * a group will always summarise the group, and a digest that says "these four
 * links are about technology" is worse than no digest: it spends the reader's
 * attention and teaches them the feature is noise. So `coherent: false` is
 * named first, given examples, and framed as the ordinary answer rather than a
 * failure.
 *
 * The second rule is provenance. The digest is rendered with a `Built from`
 * row naming every source, so the text must not name a source the row does not
 * carry, and must not claim anything the sources do not say.
 */
export interface DigestPromptInput {
  /** Rendered source block: one entry per save, numbered for reference. */
  sources: string;
  /** The measured mean pairwise similarity, for the model's calibration. */
  coherence: number;
}

export const DIGEST_PROMPT = `
You are writing one short observation about a group of links a person saved to
their own library in the last two weeks. They will see it in their feed, above
a row naming every link it was built from.

## The saves

{{SOURCES}}

These were grouped by measuring how close their contents are to each other. The
measured similarity of the group is {{COHERENCE}} on a 0-1 scale.

## What to return

First decide whether these saves genuinely share **one argument, question, or
subject** — something a person would recognise as "yes, I have been circling
that".

Return \`"coherent": false\` when they do not, and stop there. That is a normal
answer and it is the right one whenever:

- the only thing they share is a broad field ("technology", "business",
  "health"), which is a category, not an observation;
- one or two of them are clearly about something else;
- the group is a list of things rather than a thread of thought.

Return \`"coherent": true\` only when you can state the shared thread in one
concrete sentence. Then write:

- **title** — the observation itself, one line, under 80 characters, in the
  second person or in plain statement form. It should tell the reader something
  they had not quite noticed. Good: "Four of your saves are circling the same
  argument about memory". Bad: "Your recent saves about AI".
- **summary** — two or three sentences naming the thread and what it turns on.
  If the sources disagree with each other, say so; a disagreement between two
  things someone saved is the most useful thing a digest can point out.
- **keyPoints** — 2 or 3 findings. Each is one sentence, under 140 characters,
  and each must come from the saves above. Optionally give a short lead-in in
  \`term\` ("Memory beats context.") followed by the finding in \`text\`. These
  are findings, not steps: do not number them and do not order them.

## Rules

- Never mention a source that is not in the list above.
- Never state anything the saves do not support. If you are inferring, say so
  in the sentence itself ("two of these imply...").
- No hedging openers. Not "This collection of articles", not "These saves
  discuss". Start with the observation.
- Write in the person's own vocabulary, taken from the titles and summaries
  above.

## Response format

Return a JSON object and nothing else:
{
  "coherent": boolean,
  "title": string,
  "summary": string,
  "keyPoints": [{ "term": string | null, "text": string }]
}

When \`coherent\` is false, return empty strings for \`title\` and \`summary\`
and an empty array for \`keyPoints\`.
`;

export function buildDigestPrompt(input: DigestPromptInput): string {
  return DIGEST_PROMPT.replace("{{SOURCES}}", input.sources).replace(
    "{{COHERENCE}}",
    input.coherence.toFixed(2)
  );
}

/** One numbered block per save: what the model is allowed to draw from. */
export function buildDigestSourceBlock(
  saves: {
    title: string;
    url: string;
    summary: string | null;
    tags: string[];
  }[]
): string {
  return saves
    .map((save, index) => {
      const lines = [
        `${index + 1}. **${save.title}**`,
        `   URL: ${save.url}`,
      ];
      if (save.summary) lines.push(`   Summary: ${save.summary}`);
      if (save.tags.length > 0) lines.push(`   Tags: ${save.tags.join(", ")}`);
      return lines.join("\n");
    })
    .join("\n\n");
}
