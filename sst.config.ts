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

    const authDomainPrefix = `${$app.name}-${$app.stage}`;
    const cognitoDomainUrl = `https://${authDomainPrefix}.auth.ap-southeast-1.amazoncognito.com`;

    const corsOrigins = ((): string[] => {
      if (isCustomDomainStage && baseDomain) {
        return [`https://app.${stagePrefix}${baseDomain}`];
      }
      return ["*"];
    })();

    const userPool = new sst.aws.CognitoUserPool("UserPool", {
      usernames: ["email"],
      transform: {
        userPool: {
          adminCreateUserConfig: {
            allowAdminCreateUserOnly: true,
          },
          schemas: [
            {
              name: "name",
              attributeDataType: "String",
              required: true,
              mutable: true,
            },
          ],
        },
      },
    });

    new aws.cognito.UserPoolDomain("UserPoolDomain", {
      domain: authDomainPrefix,
      userPoolId: userPool.id,
    });

    const api = new sst.aws.ApiGatewayV2("Api", {
      cors: {
        allowOrigins: corsOrigins,
        allowMethods: ["*"],
        allowHeaders: ["content-type", "authorization"],
      },
      domain: domain.api,
    });

    const callbackUrls = ((): string[] => {
      if (isCustomDomainStage && baseDomain) {
        return [`https://app.${stagePrefix}${baseDomain}/callback`];
      }
      return ["http://localhost:5173/callback"];
    })();

    const userPoolClient = userPool.addClient("WebClient", {
      callbackUrls,
      transform: {
        client: {
          logoutUrls: callbackUrls,
        },
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
        VITE_USER_POOL_ID: userPool.id,
        VITE_USER_POOL_CLIENT_ID: userPoolClient.id,
        VITE_COGNITO_DOMAIN: cognitoDomainUrl,
      },
    });

    const cognitoAuthorizer = api.addAuthorizer({
      name: "CognitoAuthorizer",
      jwt: {
        issuer: $interpolate`https://cognito-idp.${aws.getRegionOutput().name}.amazonaws.com/${userPool.id}`,
        audiences: [userPoolClient.id],
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

    api.route(
      "GET /api/verify",
      {
        handler: "apps/api/src/verify/index.handler",
        runtime: "nodejs22.x",
      },
      {
        auth: {
          jwt: {
            authorizer: cognitoAuthorizer.id,
          },
        },
      },
    );

    api.route(
      "GET /api/users/assignees",
      {
        handler: "apps/api/src/users/index.handler",
        runtime: "nodejs22.x",
        environment: {
          USER_POOL_ID: userPool.id,
        },
        permissions: [
          {
            actions: ["cognito-idp:ListUsers"],
            resources: [userPool.arn],
          },
        ],
      },
      {
        auth: {
          jwt: {
            authorizer: cognitoAuthorizer.id,
          },
        },
      },
    );

    return {
      api: api.url,
      web: web.url,
      userPool: userPool.id,
      userPoolClient: userPoolClient.id,
      authDomain: cognitoDomainUrl,
    };
  },
});
