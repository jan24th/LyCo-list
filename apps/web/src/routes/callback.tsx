import { LoginButton } from "@/components/LoginButton";
import { parseCallbackCode } from "@/lib/auth";
import {
  createFileRoute,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { fetchAuthSession } from "aws-amplify/auth";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/callback")({
  component: CallbackPage,
});

export function CallbackPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const code = parseCallbackCode(location.searchStr);
    if (!code) {
      setError("缺少授权码");
      setProcessing(false);
      return;
    }

    fetchAuthSession()
      .then(() => {
        navigate({ to: "/" });
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "登录失败");
      })
      .finally(() => {
        setProcessing(false);
      });
  }, [location.searchStr, navigate]);

  if (processing) {
    return <div className="p-4">正在完成登录…</div>;
  }

  if (error) {
    return (
      <div className="space-y-4 p-4">
        <div className="text-red-600">登录失败：{error}</div>
        <LoginButton />
      </div>
    );
  }

  return null;
}
