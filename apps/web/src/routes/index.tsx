import { Button } from "@/components/ui/button";
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

  useEffect(() => {
    getCurrentUser()
      .then((user) => setUserId(user.userId))
      .catch(() => setUserId(null))
      .finally(() => setLoading(false));
  }, []);

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
      <Link to="/about">
        <Button>关于</Button>
      </Link>
    </div>
  );
}
