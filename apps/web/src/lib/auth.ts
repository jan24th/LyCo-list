import { Amplify, type ResourcesConfig } from "aws-amplify";

export interface AuthConfig {
  userPoolId: string;
  userPoolClientId: string;
  oauthDomain: string;
}

export function buildRedirectUrls(origin: string): {
  redirectSignIn: string[];
  redirectSignOut: string[];
} {
  const normalizedOrigin = origin.endsWith("/") ? origin : `${origin}/`;
  return {
    redirectSignIn: [normalizedOrigin],
    redirectSignOut: [normalizedOrigin],
  };
}

export function normalizeOAuthDomain(domain: string): string {
  return domain.replace(/^https?:\/\//, "");
}

export function validateAuthConfig(config: AuthConfig): void {
  if (!config.userPoolId) {
    throw new Error("VITE_USER_POOL_ID is not configured");
  }
  if (!config.userPoolClientId) {
    throw new Error("VITE_USER_POOL_CLIENT_ID is not configured");
  }
  if (!config.oauthDomain) {
    throw new Error("VITE_COGNITO_DOMAIN is not configured");
  }
}

export function buildAmplifyConfig(
  config: AuthConfig,
  origin: string,
): ResourcesConfig {
  const { redirectSignIn, redirectSignOut } = buildRedirectUrls(origin);

  return {
    Auth: {
      Cognito: {
        userPoolId: config.userPoolId,
        userPoolClientId: config.userPoolClientId,
        loginWith: {
          oauth: {
            domain: normalizeOAuthDomain(config.oauthDomain),
            scopes: ["openid", "email", "profile"],
            redirectSignIn,
            redirectSignOut,
            responseType: "code",
          },
        },
      },
    },
  };
}

export function configureAmplify(
  config: AuthConfig,
  origin: string | undefined = globalThis.window?.location.origin,
): void {
  if (!origin) {
    throw new Error("Cannot configure Amplify without an origin");
  }
  validateAuthConfig(config);
  Amplify.configure(buildAmplifyConfig(config, origin));
}
