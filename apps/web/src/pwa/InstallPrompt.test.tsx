import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InstallPrompt } from "./InstallPrompt";

describe("InstallPrompt", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows install button when beforeinstallprompt fires", async () => {
    render(<InstallPrompt />);

    const promptFn = vi.fn().mockResolvedValue(undefined);
    const event = new Event("beforeinstallprompt") as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string }>;
    };
    Object.defineProperty(event, "prompt", { value: promptFn });
    Object.defineProperty(event, "userChoice", {
      value: Promise.resolve({ outcome: "accepted" }),
    });

    window.dispatchEvent(event);

    await waitFor(() => {
      expect(screen.getByText("安装 LyCo-list")).toBeDefined();
    });
  });

  it("hides button when display-mode is standalone", () => {
    // Simulate already installed PWA
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(display-mode: standalone)",
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }));

    render(<InstallPrompt />);

    expect(screen.queryByText("安装 LyCo-list")).toBeNull();
  });

  it("calls prompt and hides on accepted install", async () => {
    render(<InstallPrompt />);

    const promptFn = vi.fn().mockResolvedValue(undefined);
    const event = new Event("beforeinstallprompt") as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string }>;
    };
    Object.defineProperty(event, "prompt", { value: promptFn });
    Object.defineProperty(event, "userChoice", {
      value: Promise.resolve({ outcome: "accepted" }),
    });

    window.dispatchEvent(event);

    await waitFor(() => {
      expect(screen.getByText("安装 LyCo-list")).toBeDefined();
    });

    const button = screen.getByText("安装 LyCo-list");
    fireEvent.click(button);

    expect(promptFn).toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.queryByText("安装 LyCo-list")).toBeNull();
    });
  });
});
