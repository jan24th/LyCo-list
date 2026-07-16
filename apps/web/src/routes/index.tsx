import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";
import { Link, createFileRoute } from "@tanstack/react-router";
import { getCurrentUser } from "aws-amplify/auth";
import { useEffect, useState } from "react";
import { LoginButton } from "../components/LoginButton";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifyResult, setVerifyResult] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUser()
      .then((user) => setUserId(user.userId))
      .catch(() => setUserId(null))
      .finally(() => setLoading(false));
  }, []);

  async function handleVerifyApi() {
    setVerifyResult(null);
    setVerifyError(null);
    try {
      const data = await apiClient<{ userId: string }>("/api/verify");
      setVerifyResult(data.userId);
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "验证失败");
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">今天</h2>
      <p className="text-slate-600">智能列表占位页</p>
      <div>
        {loading ? (
          <p>加载中…</p>
        ) : userId ? (
          <p>已登录用户：{userId}</p>
        ) : (
          <LoginButton />
        )}
      </div>
      <div className="space-y-2">
        <Button onClick={() => void handleVerifyApi()}>验证 API</Button>
        {verifyResult && (
          <p className="text-green-700">API 用户：{verifyResult}</p>
        )}
        {verifyError && <p className="text-red-600">验证失败：{verifyError}</p>}
      </div>
      <Link to="/about">
        <Button>关于</Button>
      </Link>
    </div>
  );
}
