import type { SessionMe } from '@mammoth/shared';

export const IS_LOGIN_KEY = 'mammothai_is_login';
export const CURRENT_USER_KEY = 'mammothai_current_user';

export function getIsLogin() {
  return localStorage.getItem(IS_LOGIN_KEY) === 'true';
}

export function getCachedSession(): SessionMe | null {
  const raw = localStorage.getItem(CURRENT_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionMe;
  } catch {
    return null;
  }
}

export function setSessionCache(session: SessionMe) {
  localStorage.setItem(IS_LOGIN_KEY, 'true');
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(session));
}

export function clearSessionCache() {
  localStorage.removeItem(IS_LOGIN_KEY);
  localStorage.removeItem(CURRENT_USER_KEY);
}
