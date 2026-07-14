# LyCo-list AWS 开发环境配置白皮书

## 概述

本文档面向 LyCo-list 项目的开发者与 DevOps 维护人员，说明如何为 SST v3 本地开发环境（`sst dev`）和后续部署配置 AWS 账号、凭证与最小权限 IAM 策略。

LyCo-list 使用 SST v3 作为基础设施即代码（IaC）工具，运行在 AWS 区域 `ap-southeast-1`。开发阶段会在真实 AWS 环境中创建以下资源：

- **API Gateway HTTP API v2**：前端 API 入口
- **AWS Lambda**：后端函数（当前为占位 health handler）
- **Amazon S3 + CloudFront**：前端 `StaticSite` 部署
- **Pulumi state backend**（SST 自动创建）：S3 bucket、DynamoDB 表、KMS key、SSM parameter

生产环境（`prod` stage）还会创建：

- **Amazon Cognito User Pool**：身份认证（ticket 002）
- **Amazon DynamoDB**：单表数据存储（ticket 003）
- **Amazon EventBridge Scheduler + Lambda**：延迟清理（后续 ticket）

## 前置条件

在开始之前，请确认已具备：

1. 一个有效的 AWS 账号。
2. 本地已安装：
   - [Bun](https://bun.sh/) 1.2+
   - [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
3. 已完成 LyCo-list 仓库依赖安装：

```bash
bun install --registry https://registry.npmmirror.com
bunx sst install
```

## 账号与区域

### 推荐方案

- **区域**：固定使用 `ap-southeast-1`（新加坡），与 `sst.config.ts` 中的 `providers.aws.region` 保持一致。
- **账号隔离**：
  - 个人开发：使用独立 AWS 账号或在主账号中为每位开发者创建独立 IAM 用户。
  - 团队协作：建议使用 AWS Organizations + 独立开发账号，避免资源冲突。
- **Stage 命名**：本地开发使用 `dev`，不要创建 `test` stage；生产使用 `prod`。

## 凭证配置

SST 通过标准 AWS SDK 方式读取凭证，优先级如下：

1. 环境变量 `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN`
2. `~/.aws/credentials` 中的 profile
3. 容器或 EC2/ECS 实例角色

### 方式一：IAM 长期凭证（个人开发）

1. 在 AWS IAM 控制台创建用户，例如 `lyco-dev-user`。
2. 选择 **Programmatic access**。
3. 保存 Access Key ID 和 Secret Access Key。
4. 本地配置：

```bash
aws configure --profile lyco-dev
# AWS Access Key ID: <your-access-key>
# AWS Secret Access Key: <your-secret-key>
# Default region name: ap-southeast-1
# Default output format: json
```

配置完成后，在终端设置：

```bash
export AWS_PROFILE=lyco-dev
export AWS_REGION=ap-southeast-1
```

### 方式二：AWS SSO / Identity Center（推荐企业环境）

```bash
aws configure sso
aws sso login --profile lyco-dev-sso
export AWS_PROFILE=lyco-dev-sso
export AWS_REGION=ap-southeast-1
```

### 方式三：环境变量（CI/CD 常用）

```bash
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...
export AWS_REGION=ap-southeast-1
```

## 最小权限 IAM 策略

开发阶段可以使用 `AdministratorAccess` 快速开始，但强烈建议为 IAM 用户或角色配置最小权限策略。以下策略覆盖 LyCo-list 当前 ticket 001 所需资源，以及后续 ticket 002/003 的预留能力。

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SSTStateBackend",
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:DeleteBucket",
        "s3:GetBucketLocation",
        "s3:GetBucketPolicy",
        "s3:PutBucketPolicy",
        "s3:PutBucketVersioning",
        "s3:PutBucketEncryption",
        "s3:PutBucketPublicAccessBlock",
        "s3:PutBucketOwnershipControls",
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "dynamodb:CreateTable",
        "dynamodb:DeleteTable",
        "dynamodb:DescribeTable",
        "dynamodb:UpdateTable",
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "kms:CreateKey",
        "kms:DescribeKey",
        "kms:EnableKeyRotation",
        "kms:Decrypt",
        "kms:Encrypt",
        "kms:GenerateDataKey",
        "ssm:PutParameter",
        "ssm:GetParameter",
        "ssm:GetParameters",
        "ssm:DeleteParameter"
      ],
      "Resource": "*"
    },
    {
      "Sid": "IAMForSSTAndLambda",
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:GetRole",
        "iam:UpdateRole",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:GetRolePolicy",
        "iam:PassRole",
        "iam:CreateInstanceProfile",
        "iam:DeleteInstanceProfile",
        "iam:AddRoleToInstanceProfile",
        "iam:RemoveRoleFromInstanceProfile",
        "iam:ListAttachedRolePolicies",
        "iam:ListRolePolicies",
        "iam:UpdateAssumeRolePolicy"
      ],
      "Resource": "*"
    },
    {
      "Sid": "APIGateway",
      "Effect": "Allow",
      "Action": [
        "apigateway:GET",
        "apigateway:POST",
        "apigateway:PUT",
        "apigateway:DELETE",
        "apigateway:PATCH"
      ],
      "Resource": "arn:aws:apigateway:ap-southeast-1::/*"
    },
    {
      "Sid": "Lambda",
      "Effect": "Allow",
      "Action": [
        "lambda:CreateFunction",
        "lambda:DeleteFunction",
        "lambda:GetFunction",
        "lambda:UpdateFunctionCode",
        "lambda:UpdateFunctionConfiguration",
        "lambda:InvokeFunction",
        "lambda:AddPermission",
        "lambda:RemovePermission",
        "lambda:ListVersionsByFunction",
        "lambda:PublishVersion",
        "lambda:TagResource",
        "lambda:UntagResource",
        "lambda:ListTags",
        "lambda:GetPolicy"
      ],
      "Resource": "*"
    },
    {
      "Sid": "Logs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:DeleteLogGroup",
        "logs:DescribeLogGroups",
        "logs:PutRetentionPolicy",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CloudFront",
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateDistribution",
        "cloudfront:DeleteDistribution",
        "cloudfront:GetDistribution",
        "cloudfront:UpdateDistribution",
        "cloudfront:CreateOriginAccessControl",
        "cloudfront:DeleteOriginAccessControl",
        "cloudfront:GetOriginAccessControl",
        "cloudfront:UpdateOriginAccessControl",
        "cloudfront:TagResource",
        "cloudfront:UntagResource",
        "cloudfront:ListTagsForResource",
        "cloudfront:CreateInvalidation",
        "cloudfront:GetInvalidation",
        "cloudfront:ListInvalidations"
      ],
      "Resource": "*"
    },
    {
      "Sid": "Cognito",
      "Effect": "Allow",
      "Action": [
        "cognito-idp:CreateUserPool",
        "cognito-idp:DeleteUserPool",
        "cognito-idp:DescribeUserPool",
        "cognito-idp:UpdateUserPool",
        "cognito-idp:CreateUserPoolClient",
        "cognito-idp:DeleteUserPoolClient",
        "cognito-idp:DescribeUserPoolClient",
        "cognito-idp:UpdateUserPoolClient",
        "cognito-idp:CreateUserPoolDomain",
        "cognito-idp:DeleteUserPoolDomain",
        "cognito-idp:DescribeUserPoolDomain",
        "cognito-idp:ListUsers",
        "cognito-idp:AdminCreateUser",
        "cognito-idp:AdminDeleteUser",
        "cognito-idp:AdminGetUser",
        "cognito-idp:AdminListUsersForGroup"
      ],
      "Resource": "*"
    },
    {
      "Sid": "DynamoDB",
      "Effect": "Allow",
      "Action": [
        "dynamodb:CreateTable",
        "dynamodb:DeleteTable",
        "dynamodb:DescribeTable",
        "dynamodb:UpdateTable",
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:BatchGetItem",
        "dynamodb:BatchWriteItem",
        "dynamodb:DescribeTimeToLive",
        "dynamodb:UpdateTimeToLive"
      ],
      "Resource": "*"
    },
    {
      "Sid": "EventBridgeScheduler",
      "Effect": "Allow",
      "Action": [
        "scheduler:CreateSchedule",
        "scheduler:DeleteSchedule",
        "scheduler:GetSchedule",
        "scheduler:UpdateSchedule",
        "scheduler:CreateScheduleGroup",
        "scheduler:DeleteScheduleGroup",
        "scheduler:GetScheduleGroup",
        "scheduler:ListScheduleGroups"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ReadOnlyForGeneral",
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeAvailabilityZones",
        "ec2:DescribeVpcs",
        "ec2:DescribeSubnets",
        "ec2:DescribeSecurityGroups",
        "cloudformation:DescribeStacks",
        "cloudformation:ListStacks"
      ],
      "Resource": "*"
    }
  ]
}
```

## SST State Backend（Pulumi）

SST 3 使用 Pulumi 作为底层引擎，默认使用 Pulumi Service 托管的 state backend（无需额外配置），但要求运行环境能够访问 Pulumi 服务。若无法访问 Pulumi 服务，或需要自托管 state，可配置 S3 backend：

```bash
# 自托管 S3 backend（可选）
export SST_STATE_BACKEND=s3
export SST_STATE_BUCKET=lyco-pulumi-state-<account-id>
export SST_STATE_TABLE=lyco-pulumi-state-<account-id>
```

> 默认情况下，SST 3 使用 Pulumi Service 托管 state，首次 `sst dev` 会自动在本地生成 `~/.config/sst` 配置。

## 运行本地开发环境

1. 确认凭证生效：

```bash
aws sts get-caller-identity
```

2. 启动 SST 开发环境：

```bash
bun dev
# 等价于
# sst dev --stage dev
```

3. 观察输出，直到出现：

```
api: https://xxxxxxxx.execute-api.ap-southeast-1.amazonaws.com
web: https://xxxxxxxx.cloudfront.net
```

4. 测试 health 接口：

```bash
curl https://<api-url>/api/health
# 期望返回 {"ok":true}
```

## 当前 ticket 001 的限制

- `USER_POOL_ID` 和 `USER_POOL_CLIENT_ID` 使用占位值 `todo-in-ticket-002`，Cognito 相关功能不可用。
- 占位值不会影响 health handler 的部署与访问，但 `/api/health` 仅返回 `{ ok: true }`。
- 前端 `StaticSite` 构建时会运行 `bun run build`，确保 `apps/web` 可成功构建。

## 安全规范

- **禁止**将 AWS Access Key / Secret Key 提交到 Git 仓库或写入 `.env` 文件后提交。
- `.env`、`.env.*、AWS 凭证文件、`.sst/` 已配置在 `.gitignore` 中。
- 开发账号建议使用独立 IAM 用户，并启用 MFA。
- 生产部署（`prod` stage）使用独立角色或账号，不要复用 `dev` 凭证。
- 定期检查 CloudWatch Logs 和 IAM access advisor，回收未使用权限。

## 常见问题排查

### `aws sts get-caller-identity` 失败

- 检查 `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` 是否正确。
- 检查 `AWS_PROFILE` 是否指向存在的 profile。
- SSO 用户需要运行 `aws sso login`。

### `sst dev` 报 `AccessDenied`

- 当前 IAM 权限不足，建议临时附加 `AdministratorAccess` 以确认是否是权限问题，再逐步收紧到最小权限策略。
- 检查是否缺少 `iam:PassRole` 或 `apigateway:*` 权限。

### `sst dev` 报 `region not found` 或资源创建到错误区域

- 确认 `AWS_REGION` 或 default region 设置为 `ap-southeast-1`。
- 不要修改 `sst.config.ts` 中的 region，除非有意迁移整个部署。

### 前端 `StaticSite` 构建失败

- 先独立运行 `cd apps/web && bun run build`，确认构建无错误。
- 检查 `VITE_API_URL` 等环境变量是否正确注入。

### 网络问题导致 `sst install` 失败

- 重试 `bunx sst install`。
- 若 SST telemetry 网络不稳定，可忽略 telemetry 报错，手动重试。

## 清理开发环境

如需删除 `dev` stage 创建的资源：

```bash
sst remove --stage dev
```

> 警告：这会删除 API Gateway、Lambda、CloudFront 和 S3 等由 SST 管理的资源。Pulumi state backend 相关的 S3 bucket / DynamoDB 表不会被删除，需手动清理。

## 参考

- [SST v3 文档](https://sst.dev/docs/)
- [AWS CLI 配置](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html)
- [Pulumi Service State Backend](https://www.pulumi.com/docs/concepts/state/)
- [AWS IAM 最小权限最佳实践](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html#grant-least-privilege)

## 版本记录

| 版本 | 日期 | 说明 |
| --- | --- | --- |
| 1.0 | 2026-07-14 | 初始版本，覆盖 ticket 001 开发环境配置 |
