import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

function StyledBox() {
  return <div className="bg-slate-50 text-slate-900 p-4">Styled</div>;
}

describe("Tailwind CSS integration", () => {
  it("renders an element with Tailwind classes", () => {
    const { container } = render(<StyledBox />);
    const element = container.firstChild as HTMLElement;
    expect(element).toHaveClass("bg-slate-50");
    expect(element).toHaveClass("text-slate-900");
  });
});
