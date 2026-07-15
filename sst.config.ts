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
    const isProd = $app.stage === "prod";
    const baseDomain = process.env.BASE_DOMAIN;
    const domain = {
      api: isProd && baseDomain ? `api.${baseDomain}` : undefined,
      web: isProd && baseDomain ? `app.${baseDomain}` : undefined,
    };

    const userPoolId = new sst.Secret("USER_POOL_ID", "todo-in-ticket-002");
    const userPoolClientId = new sst.Secret(
      "USER_POOL_CLIENT_ID",
      "todo-in-ticket-002",
    );

    const api = new sst.aws.ApiGatewayV2("Api", {
      cors: {
        allowOrigins: ["*"],
        allowMethods: ["*"],
        allowHeaders: ["content-type", "authorization"],
      },
      domain: domain.api,
    });

    api.route("GET /api/health", {
      handler: "apps/api/src/health/index.handler",
      runtime: "nodejs22.x",
      authorizer: "none",
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
