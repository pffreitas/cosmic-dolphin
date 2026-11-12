/** Real public links; briefs are hand-written examples, not live AI output. */
export interface ReadingSample {
  id: "article" | "video" | "post";
  /** Short format name, used on the demo's tabs. */
  format: string;
  title: string;
  author: string;
  domain: string;
  url: string;
  /** What the pasted address looks like, without the scheme. */
  displayUrl: string;
  /** A plain description of the original's length. Never an invented duration. */
  length: string;
  summary: string;
  /** Key points, paraphrased from the source. A one-line post has none. */
  points: { term: string; text: string }[];
  collection: string;
  tags: string[];
}

export const readingSamples: ReadingSample[] = [
  {
    id: "article",
    format: "Article",
    title: "How to Do Great Work",
    author: "Paul Graham",
    domain: "paulgraham.com",
    url: "https://paulgraham.com/greatwork.html",
    displayUrl: "paulgraham.com/greatwork.html",
    length: "Long essay",
    summary:
      "Graham’s recipe for great work: choose a field you are deeply curious about, learn enough to reach its frontier, notice the gaps, and explore the promising ones.",
    points: [
      {
        term: "Curiosity first.",
        text: "Let real interest choose the field. It misleads you less than fashion or money.",
      },
      {
        term: "Own projects.",
        text: "Keep an ambitious project of your own going, however small it starts.",
      },
      {
        term: "Consistency.",
        text: "A little done every day compounds. Great work is rarely one burst.",
      },
    ],
    collection: "Creative work",
    tags: ["curiosity", "craft"],
  },
  {
    id: "video",
    format: "Video",
    title: "Intro to Large Language Models",
    author: "Andrej Karpathy",
    domain: "youtube.com",
    url: "https://www.youtube.com/watch?v=zjkBMFhNj_g",
    displayUrl: "youtube.com/watch?v=zjkBMFhNj_g",
    length: "1 hr talk",
    summary:
      "Karpathy explains what a language model is, how pretraining and fine-tuning shape it, and why its impressive answers still need scrutiny.",
    points: [
      {
        term: "Two files.",
        text: "A model is a large file of parameters and a small program that runs it.",
      },
      {
        term: "Prediction.",
        text: "Training compresses a huge amount of text into guessing the next word.",
      },
      {
        term: "New risks.",
        text: "Jailbreaks and prompt injection are open security problems.",
      },
    ],
    collection: "Understanding AI",
    tags: ["llms", "explainer"],
  },
  {
    id: "post",
    format: "Post",
    title: "Better systems, better habits",
    author: "James Clear",
    domain: "x.com",
    url: "https://x.com/JamesClear/status/1047643455722283009",
    displayUrl: "x.com/JamesClear/status/1047643455722283009",
    length: "Short post",
    summary:
      "Goals set the direction. The systems you repeat each day decide the result.",
    points: [],
    collection: "Better habits",
    tags: ["habits", "systems"],
  },
];
