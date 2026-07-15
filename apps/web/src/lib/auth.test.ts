import { describe, expect, it, vi } from "vitest";
import {
  buildAmplifyConfig,
  buildRedirectUrls,
  configureAmplify,
} from "./auth";

const { mockConfigure } = vi.hoisted(() => ({ mockConfigure: vi.fn() }));

vi.mock("aws-amplify", () => ({
  Amplify: { configure: mockConfigure },
}));

const baseConfig = {
  userPoolId: "ap-southeast-1_123456789",
  userPoolClientId: "abc123",
  oauthDomain: "auth.example.com",
};

describe("buildRedirectUrls", () => {
  it("adds trailing slash when missing", () => {
    expect(buildRedirectUrls("https://app.example.com")).toEqual({
      redirectSignIn: ["https://app.example.com/"],
      redirectSignOut: ["https://app.example.com/"],
    });
  });

  it("keeps trailing slash when present", () => {
    expect(buildRedirectUrls("https://app.example.com/")).toEqual({
      redirectSignIn: ["https://app.example.com/"],
      redirectSignOut: ["https://app.example.com/"],
    });
  });
});

describe("buildAmplifyConfig", () => {
  it("returns valid Cognito OAuth configuration", () => {
    const config = buildAmplifyConfig(baseConfig, "https://app.example.com");

    expect(config).toEqual({
      Auth: {
        Cognito: {
          userPoolId: baseConfig.userPoolId,
          userPoolClientId: baseConfig.userPoolClientId,
          loginWith: {
            oauth: {
              domain: baseConfig.oauthDomain,
              scopes: ["openid", "email", "profile"],
              redirectSignIn: ["https://app.example.com/"],
              redirectSignOut: ["https://app.example.com/"],
              responseType: "code",
            },
          },
        },
      },
    });
  });
});

describe("configureAmplify", () => {
  it("configures Amplify with normalized origin", () => {
    configureAmplify(baseConfig, "https://app.example.com");

    expect(mockConfigure).toHaveBeenCalledWith(
      buildAmplifyConfig(baseConfig, "https://app.example.com"),
    );
  });

  it("uses window.location.origin when origin is not provided", () => {
    const originalWindow = globalThis.window;
    globalThis.window = {
      location: { origin: "https://fallback.example.com" },
    } as unknown as Window & typeof globalThis.window;

    configureAmplify(baseConfig);

    expect(mockConfigure).toHaveBeenCalledWith(
      buildAmplifyConfig(baseConfig, "https://fallback.example.com"),
    );

    globalThis.window = originalWindow;
  });

  it("throws when origin cannot be determined", () => {
    const originalWindow = globalThis.window;
    (globalThis as unknown as { window?: Window }).window = undefined;

    expect(() => configureAmplify(baseConfig)).toThrow(
      "Cannot configure Amplify without an origin",
    );

    globalThis.window = originalWindow;
  });
});
