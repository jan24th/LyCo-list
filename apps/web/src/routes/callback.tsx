import { createFileRoute } from "@tanstack/react-router";
import { getCurrentUser } from "aws-amplify/auth";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/callback")({
  component: CallbackPage,
});

function CallbackPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUser()
      .then((user) => setUserId(user.userId))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "登录失败");
      });
  }, []);

  if (error) {
    return <div className="p-4 text-red-600">登录失败：{error}</div>;
  }

  if (!userId) {
    return <div className="p-4">正在完成登录…</div>;
  }

  return <div className="p-4">登录成功，用户 ID：{userId}</div>;
}
