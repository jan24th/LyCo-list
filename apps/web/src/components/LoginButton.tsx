import { Button } from "@/components/ui/button";
import { signInWithRedirect } from "aws-amplify/auth";

export function LoginButton() {
  return <Button onClick={() => void signInWithRedirect()}>登录</Button>;
}
