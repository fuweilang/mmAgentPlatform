const SKIP_OIDC_KEY = "mammoth_skip_oidc";

/** In-app route the OIDC round-trip returns to. */
const OCTOP_HOME_PATH = "/chat";

/** Absolute URL the unified login sends the user back to after the OIDC round-trip. */
export function octopReturnUrl() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${window.location.origin}${base}${OCTOP_HOME_PATH}`;
}

export function mammothLoginUrl(next?: string) {
  const url = new URL("/login", window.location.origin);
  if (next) url.searchParams.set("next", next);
  return url.toString();
}

export function goMammothLogin(next?: string) {
  window.location.replace(mammothLoginUrl(next));
}

/**
 * Mint an Octop session straight from the Octop SPA.
 *
 * The agent and the platform front-end share an origin, so asking Octop for the
 * authorize URL keeps the platform's own session check on the server side: when
 * the platform session cookie is present ``/authorize`` redirects back
 * immediately, and when it is missing ``/authorize`` itself redirects to
 * ``/login?next=<authorize>``. Either way the user is spared a full load of the
 * unified login page before the same round-trip.
 */
export async function startMammothSession(): Promise<void> {
  try {
    const { authApi } = await import("../api/modules/auth");
    const { authorization_url } = await authApi.startOauth(
      "oidc",
      OCTOP_HOME_PATH,
    );
    if (authorization_url) {
      window.location.replace(authorization_url);
      return;
    }
  } catch {
    /* fall through to the unified login */
  }
  goMammothLogin(octopReturnUrl());
}

export function markSkipOidc() {
  sessionStorage.setItem(SKIP_OIDC_KEY, "1");
}

export function consumeSkipOidc() {
  const skip = sessionStorage.getItem(SKIP_OIDC_KEY) === "1";
  if (skip) sessionStorage.removeItem(SKIP_OIDC_KEY);
  return skip;
}

export async function logoutMammothIdp() {
  await fetch("/console/api/auth/logout", {
    method: "POST",
    credentials: "include",
  }).catch(() => undefined);
  localStorage.removeItem("mammothai_is_login");
  localStorage.removeItem("mammothai_current_user");
}
