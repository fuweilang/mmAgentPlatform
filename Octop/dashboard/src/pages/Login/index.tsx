import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Result, Spin } from "antd";
import {
  MammothLoginUnreachableError,
  startMammothSession,
} from "../../utils/mammothSso";

/** Legacy /agent/login — leave for the 猛犸 login. Never stay on a blank page. */
export default function LoginPage() {
  const { t } = useTranslation();
  const [origin, setOrigin] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void startMammothSession().catch((error: unknown) => {
      if (cancelled) return;
      setOrigin(
        error instanceof MammothLoginUnreachableError ? error.origin : "",
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (origin !== null) {
    return (
      <div
        style={{
          height: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Result
          status="warning"
          title={t("errors.loginUnreachableTitle")}
          subTitle={t("errors.loginUnreachableSubtitle", {
            origin: origin || t("errors.loginUnreachableUnknown"),
          })}
          extra={
            <Button type="primary" onClick={() => window.location.reload()}>
              {t("errors.retry")}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Spin size="large" />
    </div>
  );
}
