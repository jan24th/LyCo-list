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

    const userPoolId = new sst.Secret("USER_POOL_ID", "todo-in-ticket-002");
    const userPoolClientId = new sst.Secret(
      "USER_POOL_CLIENT_ID",
      "todo-in-ticket-002",
    );

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

    const api = new sst.aws.ApiGatewayV2("Api", {
      cors: {
        allowOrigins: corsOrigins,
        allowMethods: ["*"],
        allowHeaders: ["content-type", "authorization"],
      },
      domain: domain.api,
    });

    api.route("GET /api/health", {
      handler: "apps/api/src/health/index.handler",
      runtime: "nodejs22.x",
      environment: {
        USER_POOL_ID: userPoolId.value,
        USER_POOL_CLIENT_ID: userPoolClientId.value,
      },
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
        VITE_USER_POOL_ID: userPoolId.value,
        VITE_USER_POOL_CLIENT_ID: userPoolClientId.value,
      },
    });

    return {
      api: api.url,
      web: web.url,
    };
  },
});
