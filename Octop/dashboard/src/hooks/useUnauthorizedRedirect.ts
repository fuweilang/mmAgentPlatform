import { useEffect } from "react";
import { UNAUTHORIZED_EVENT } from "../api/request";
import { startMammothSession } from "../utils/mammothSso";

export function useUnauthorizedRedirect(): void {
  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      void startMammothSession();
    };
    window.addEventListener(UNAUTHORIZED_EVENT, handler);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler);
  }, []);
}
