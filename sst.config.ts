/// <reference types="./.sst/platform/config.d.ts" />
export default $config({
  app(input) {
    return {
      name: "lyco-list",
      removal: input?.stage === "prod" ? "retain" : "remove",
      home: "aws",
      providers: {
        aws: {
          region: "ap-southeast-1",
          profile: process.env.AWS_PROFILE,
        },
      },
    };
  },
  async run() {
    const baseDomain = process.env.BASE_DOMAIN;
    const isCustomDomainStage = $app.stage === "prod" || $app.stage === "acc";
    const stagePrefix = $app.stage === "prod" ? "" : `${$app.stage}.`;
    const domain = {
      api:
        isCustomDomainStage && baseDomain
          ? `api.${stagePrefix}${baseDomain}`
          : undefined,
      web:
        isCustomDomainStage && baseDomain
          ? `app.${stagePrefix}${baseDomain}`
          : undefined,
    };

    const authDomain =
      isCustomDomainStage && baseDomain
        ? `auth.${stagePrefix}${baseDomain}`
        : undefined;

    const corsOrigins = ((): string[] => {
      switch ($app.stage) {
        case "acc":
          return ["https://app.acc.jan24th.today"];
        case "prod":
          return ["https://app.jan24th.today"];
        default:
          return ["*"];
      }
    })();

    const userPool = new sst.aws.CognitoUserPool("UserPool", {
      usernames: ["email"],
      transform: {
        userPool: {
          adminCreateUserConfig: {
            allowAdminCreateUserOnly: true,
          },
        },
      },
      domain: authDomain ?? {
        prefix: `${$app.name}-${$app.stage}`,
      },
    });

    const api = new sst.aws.ApiGatewayV2("Api", {
      cors: {
        allowOrigins: corsOrigins,
        allowMethods: ["*"],
        allowHeaders: ["content-type", "authorization"],
      },
      domain: domain.api,
    });

    // biome-ignore lint/correctness/noInvalidUseBeforeDeclaration: Pulumi Output forward reference
    const callbackUrls = web.url.apply((url) => {
      const normalized = url.endsWith("/") ? url : `${url}/`;
      return $app.stage === "dev"
        ? [normalized, "http://localhost:5173/"]
        : [normalized];
    });

    const userPoolClient = userPool.addClient("WebClient", {
      callbackUrls,
      logoutUrls: callbackUrls,
    });

    const web = new sst.aws.StaticSite("Web", {
      path: "apps/web",
      build: {
        command: "bun run build",
        output: "dist",
      },
      domain: domain.web,
      environment: {
        VITE_API_URL: api.url,
        VITE_USER_POOL_ID: userPool.id,
        VITE_USER_POOL_CLIENT_ID: userPoolClient.id,
        VITE_COGNITO_DOMAIN: userPool.domainUrl,
      },
    });

    api.route("GET /api/health", {
      handler: "apps/api/src/health/index.handler",
      runtime: "nodejs22.x",
      environment: {
        USER_POOL_ID: userPool.id,
        USER_POOL_CLIENT_ID: userPoolClient.id,
      },
    });

    return {
      api: api.url,
      web: web.url,
      userPool: userPool.id,
      userPoolClient: userPoolClient.id,
      authDomain: userPool.domainUrl,
    };
  },
});
