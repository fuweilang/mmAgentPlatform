import { useEffect } from "react";
import { goMammothLogin } from "../../utils/mammothSso";

/** Legacy /agent/login — bounce to the unified login at /login. */
export default function LoginPage() {
  useEffect(() => {
    if (window.location.pathname.startsWith("/login")) return;
    goMammothLogin();
  }, []);
  return <div style={{ minHeight: "100dvh", background: "#fff" }} />;
}
