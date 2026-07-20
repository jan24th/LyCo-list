import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PopoverTitle } from "./popover";

describe("PopoverTitle", () => {
  it("renders a level-two heading with its semantic classes", () => {
    render(<PopoverTitle className="custom-title">筛选条件</PopoverTitle>);

    expect(
      screen.getByRole("heading", { level: 2, name: "筛选条件" }),
    ).toHaveClass("font-medium", "custom-title");
  });
});
