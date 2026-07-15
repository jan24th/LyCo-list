import { describe, expect, it, vi } from "vitest";
import {
  buildAmplifyConfig,
  buildRedirectUrls,
  configureAmplify,
  normalizeOAuthDomain,
  validateAuthConfig,
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

describe("normalizeOAuthDomain", () => {
  it("strips https:// prefix", () => {
    expect(normalizeOAuthDomain("https://auth.example.com")).toBe(
      "auth.example.com",
    );
  });

  it("strips http:// prefix", () => {
    expect(normalizeOAuthDomain("http://auth.example.com")).toBe(
      "auth.example.com",
    );
  });

  it("leaves bare domain unchanged", () => {
    expect(normalizeOAuthDomain("auth.example.com")).toBe("auth.example.com");
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

  it("normalizes domain when it includes protocol", () => {
    const config = buildAmplifyConfig(
      { ...baseConfig, oauthDomain: "https://auth.example.com" },
      "https://app.example.com",
    );

    const typedConfig = config as {
      Auth: {
        Cognito: {
          loginWith: {
            oauth: { domain: string };
          };
        };
      };
    };
    expect(typedConfig.Auth.Cognito.loginWith.oauth.domain).toBe(
      "auth.example.com",
    );
  });
});

describe("validateAuthConfig", () => {
  it("does not throw for valid config", () => {
    expect(() => validateAuthConfig(baseConfig)).not.toThrow();
  });

  it("throws when userPoolId is empty", () => {
    expect(() => validateAuthConfig({ ...baseConfig, userPoolId: "" })).toThrow(
      "VITE_USER_POOL_ID is not configured",
    );
  });

  it("throws when userPoolClientId is empty", () => {
    expect(() =>
      validateAuthConfig({ ...baseConfig, userPoolClientId: "" }),
    ).toThrow("VITE_USER_POOL_CLIENT_ID is not configured");
  });

  it("throws when oauthDomain is empty", () => {
    expect(() =>
      validateAuthConfig({ ...baseConfig, oauthDomain: "" }),
    ).toThrow("VITE_COGNITO_DOMAIN is not configured");
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
