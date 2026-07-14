import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the app title", () => {
    render(<App />);

    expect(screen.getByText("LyCo-list")).toBeInTheDocument();
    expect(screen.getByText("PWA 待办应用 200")).toBeInTheDocument();
  });
});
