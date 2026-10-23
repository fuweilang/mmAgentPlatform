export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function apiUrl(path: string) {
  if (path.startsWith('/api/')) {
    return `/middle/api/${path.slice(5)}`;
  }
  return path;
}

export async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const url = apiUrl(path);
  const res = await fetch(url, { ...init, headers, credentials: 'include' });
  if (res.status === 401 && !path.endsWith('/auth/login')) {
    if (!location.pathname.startsWith('/login')) location.href = '/login';
    throw new ApiError(401, '未登录');
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = data?.message;
    throw new ApiError(res.status, Array.isArray(msg) ? msg.join('；') : msg || '请求失败');
  }
  return data as T;
}
