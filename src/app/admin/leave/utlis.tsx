// Shared filters used across component & self-tests
export type RoleFilter = "all" | "teacher" | "student";
export type StatusFilter = "pending" | "approved" | "rejected" | "cancelled" | "all";

/** Build admin list URL for any status (pending uses legacy endpoint). */
export function buildAdminListUrl(base: string, role: RoleFilter, status: StatusFilter): string {
  const b = (base || "").replace(/\/$/, "");
  if (status === "pending") {
    const qs = role === "all" ? "" : `?role=${role}`;
    return `${b}/admin/pending${qs}`;
  }
  const params = new URLSearchParams();
  if (role !== "all") params.set("role", role);
  if (status !== "all") params.set("status", status);
  return `${b}/admin/requests${params.toString() ? `?${params.toString()}` : ""}`;
}

/** Safely read a backend base URL without throwing in browsers when `process` is undefined. */
export function getBackendBase(): string {
  const envBase =
    typeof process !== "undefined" && (process as any).env
      ? (process as any).env.NEXT_PUBLIC_BACKEND_URL
      : undefined;

  const winBase: string | undefined = typeof window !== "undefined" ? (window as any).__BACKEND_URL__ : undefined;

  const metaBase: string | null =
    typeof document !== "undefined"
      ? document.querySelector('meta[name="backend-url"]')?.getAttribute("content") || null
      : null;

  const chosen = (envBase || winBase || metaBase || "").toString().trim();
  return chosen.replace(/\/$/, "");
}

export function getApiBase(backendBase: string): string {
  return backendBase ? `${backendBase}/leave` : "/leave";
}

export function getAuthToken(): string | null {
  const candidates = [
    "token",
    "authToken",
    "admin_token",
    "teacher_token",
    "token_admin",
    "CMS_token",
    "token_student",
  ];
  for (const k of candidates) {
    const v = typeof window !== "undefined" ? localStorage.getItem(k) : null;
    if (v) return v;
  }
  return null;
}

/** Return a concrete `Headers` object with optional Bearer token. */
export function authHeaders(): Headers {
  const h = new Headers({ "Content-Type": "application/json" });
  const t = getAuthToken();
  if (t) h.set("Authorization", `Bearer ${t}`);
  return h;
}
