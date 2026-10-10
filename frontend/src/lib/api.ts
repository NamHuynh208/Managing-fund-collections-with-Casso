function getCookie(name: string) {
  return document.cookie.split("; ").find((c) => c.startsWith(name + "="))?.split("=")[1];
}

export class ApiError extends Error {
public status: number;

constructor(status: number, message: string) {
  super(message);
  this.status = status;
}
}

export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (method !== "GET") headers.set("X-CSRFToken", decodeURIComponent(getCookie("csrftoken") ?? ""));

  const res = await fetch(`/api${path}`, { ...init, method, headers, credentials: "same-origin" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.detail ?? "Có lỗi xảy ra");
  }
  return res.json();
}

export const post = <T = any>(path: string, data?: unknown) =>
  api<T>(path, { method: "POST", body: data === undefined ? undefined : JSON.stringify(data) });

// Gọi một lần khi app khởi động để Django đặt cookie csrftoken
export const initCsrf = () => api("/csrf");