# 为 API E2E 返回短期 Cognito access token

测试控制 API 通过 Cognito 为每个测试运行建立专属测试身份，并只返回短期 access token，不返回密码或 refresh token。运行器将该 token 传给既有业务 API 的 JWT 鉴权器，因此测试真实认证边界而不需要 Hosted UI 或测试环境的鉴权绕过。
