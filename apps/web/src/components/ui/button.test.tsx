import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("renders default variant", () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole("button", { name: "Click me" });
    expect(button).toHaveClass("bg-lyco-primary");
  });

  it("renders ghost variant", () => {
    render(<Button variant="ghost">Ghost</Button>);
    const button = screen.getByRole("button", { name: "Ghost" });
    expect(button).toHaveClass("hover:bg-slate-100");
  });

  it("calls onClick when clicked", async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    await screen.getByRole("button", { name: "Click" }).click();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("forwards ref", () => {
    let refValue: HTMLButtonElement | null = null;
    render(
      <Button
        ref={(el) => {
          refValue = el;
        }}
      >
        Ref
      </Button>,
    );
    expect(refValue).toBeInstanceOf(HTMLButtonElement);
  });
});
