import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { UiPreview } from "./UiPreview";

describe("UiPreview", () => {
  afterEach(() => document.documentElement.classList.remove("dark"));

  it("renders and edits a semantic form control", () => {
    render(<UiPreview />);
    const input = screen.getByLabelText("列表名称");
    fireEvent.change(input, { target: { value: "家庭" } });
    expect(input).toHaveValue("家庭");
    expect(input).toHaveClass("border-input");
  });

  it("opens and closes a semantic dialog", async () => {
    render(<UiPreview />);
    fireEvent.click(screen.getByRole("button", { name: "打开预览" }));
    expect(
      await screen.findByRole("dialog", { name: "组件预览" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(
      screen.queryByRole("dialog", { name: "组件预览" }),
    ).not.toBeInTheDocument();
  });

  it("keeps semantic classes under the dark root class", () => {
    document.documentElement.classList.add("dark");
    render(<UiPreview />);
    expect(screen.getByRole("button", { name: "打开预览" })).toHaveClass(
      "bg-primary",
    );
    expect(screen.getByText("主题组件基线")).toHaveClass("text-foreground");
  });
});
