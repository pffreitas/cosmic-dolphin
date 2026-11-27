import React from "react";
import { render } from "@testing-library/react-native";
import { DetailReader } from "../Reader";
jest.mock("@/contexts/PreferencesContext", () => ({
  usePreferences: () => ({ appearance: "light" }),
}));

it("renders real Markdown headings, lists, a table and a long code line without hiding the content", () => {
  const code =
    "const readingContext = buildContextFromTheSavedArticleAndItsSources();";
  const view = render(
    <DetailReader
      body={`## Article heading\n\nA paragraph with **bold words** and *emphasis*.\n\n- First point\n- Second point\n\n| Aspect | Before | After |\n| --- | --- | --- |\n| Workflow | Manual | Agents |\n\n\`\`\`ts\n${code}\n\`\`\``}
    />,
  );
  expect(view.getByRole("header", { name: "Article heading" })).toBeTruthy();
  expect(view.getByText("First point")).toBeTruthy();
  expect(view.getByText("Workflow")).toBeTruthy();
  expect(view.getByLabelText("Article table").props.horizontal).toBe(true);
  expect(view.getByLabelText("Article code").props.horizontal).toBe(true);
  expect(view.getByText(code)).toBeTruthy();
});
