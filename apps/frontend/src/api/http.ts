export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function apiUrl(path: string) {
  if (path.startsWith('/api/')) {
    return `/console/api/${path.slice(5)}`;
  }
  return path;
}

export async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const isForm = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (init.body && !headers.has('Content-Type') && !isForm) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(url, { ...init, headers, credentials: 'include' });
  if (
    res.status === 401
    && !url.endsWith('/auth/login')
    && !url.includes('/auth/browser-sso-consume')
  ) {
    if (!location.pathname.startsWith('/login')) location.href = '/login';
    throw new ApiError(401, '未登录');
  }
  const text = await res.text();
  const contentType = res.headers.get('content-type') || '';
  if (text && !contentType.includes('application/json')) {
    throw new ApiError(res.status || 502, "接口未就绪：返回的不是 JSON。请确认中台 API 和网关已重启。");
  }
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = data?.message;
    throw new ApiError(res.status, Array.isArray(msg) ? msg.join('；') : msg || '请求失败');
  }
  return data as T;
}

export async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
  return request<T>(apiUrl(path), init);
}

/** 总后台请求：`/admin/api/*` → 网关 → 中台 `/api/admin/*`。 */
export async function adminHttp<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = path.startsWith('/admin/api') ? path : `/admin/api${path}`;
  return request<T>(url, init);
}
