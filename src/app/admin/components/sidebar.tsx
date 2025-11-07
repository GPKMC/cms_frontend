"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SidebarItems } from "../types/type.sidebar";
import {
  FaUser,
  FaBook,
  FaGraduationCap,
  FaClipboardList,
  FaChalkboardTeacher,
  FaCalendarAlt,
  FaBullhorn,
  FaFileAlt,
  FaSignOutAlt,
} from "react-icons/fa";
import { BsFillPeopleFill } from "react-icons/bs";
import { Home, CalendarRange } from "lucide-react";

/* ------------------ helpers for leave icon ------------------ */
function getBackendBase(): string {
  const envBase =
    typeof process !== "undefined" && (process as any).env
      ? (process as any).env.NEXT_PUBLIC_BACKEND_URL
      : undefined;
  // ts-expect-error optional window injection
  const winBase: string | undefined =
    typeof window !== "undefined" ? (window as any).__BACKEND_URL__ : undefined;
  const metaBase: string | null =
    typeof document !== "undefined"
      ? document
          .querySelector('meta[name="backend-url"]')
          ?.getAttribute("content") || null
      : null;
  const chosen = (envBase || winBase || metaBase || "").toString().trim();
  return chosen.replace(/\/$/, "");
}
function getApiBase(base: string) {
  return base ? `${base}/leave` : "/leave";
}
function getAuthToken(): string | null {
  const keys = [
    "token",
    "authToken",
    "admin_token",
    "teacher_token",
    "token_admin",
    "CMS_token",
    "token_student",
  ];
  for (const k of keys) {
    const v = typeof window !== "undefined" ? localStorage.getItem(k) : null;
    if (v) return v;
  }
  return null;
}
function authHeaders(): Headers {
  const h = new Headers({ "Content-Type": "application/json" });
  const t = getAuthToken();
  if (t) h.set("Authorization", `Bearer ${t}`);
  return h;
}

function LeavePendingIcon({
  className = "h-5 w-5",
  role = "all",
  pollMs = 60000,
  max = 99,
}: {
  className?: string;
  role?: "all" | "teacher" | "student";
  pollMs?: number;
  max?: number;
}) {
  const API_BASE = React.useMemo(
    () => getApiBase(getBackendBase()),
    []
  );
  const headers = React.useMemo(() => authHeaders(), []);
  const [count, setCount] = React.useState<number>(0);

  async function fetchCount() {
    try {
      const qs = role === "all" ? "" : `?role=${role}`;
      let res = await fetch(`${API_BASE}/admin/pending/count${qs}`, {
        headers,
        cache: "no-store",
      });
      if (!res.ok && res.status === 404) {
        res = await fetch(`${API_BASE}/admin/pending${qs}`, {
          headers,
          cache: "no-store",
        });
        if (res.ok) {
          const json = await res.json();
          setCount(Array.isArray(json?.items) ? json.items.length : 0);
          return;
        }
      }
      if (res.ok) {
        const json = await res.json();
        setCount(Number(json?.count) || 0);
      }
    } catch {
      // ignore
    }
  }

  React.useEffect(() => {
    fetchCount();
    const id = setInterval(fetchCount, pollMs);

    const onChanged = () => fetchCount();
    if (typeof window !== "undefined") {
      window.addEventListener("leave:pending-changed", onChanged);
    }
    return () => {
      clearInterval(id);
      if (typeof window !== "undefined") {
        window.removeEventListener("leave:pending-changed", onChanged);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_BASE, role, pollMs]);

  const label = count > max ? `${max}+` : String(count);

  return (
    <span className="relative inline-flex">
      <CalendarRange className={className} />
      {count > 0 && (
        <span
          className="absolute -top-1.5 -right-1.5 min-w-[18px] px-1.5 py-[2px]
                     rounded-full bg-rose-600 text-white text-[10px] leading-none
                     font-semibold text-center shadow-sm"
          aria-label={`${count} pending leave request${
            count === 1 ? "" : "s"
          }`}
        >
          {label}
        </span>
      )}
    </span>
  );
}

/* ------------------ sidebar config ------------------ */
const sidebarItems: SidebarItems = [
  { id: 1, label: "Home", icon: <Home />, page: "/admin" },
  { id: 2, label: "Program Management", icon: <FaGraduationCap />, page: "/admin/faculty" },
  { id: 3, label: "User Management", icon: <FaUser />, page: "/admin/users" },
  { id: 4, label: "Batch Management", icon: <BsFillPeopleFill />, page: "/admin/batch" },
  { id: 5, label: "Course Management", icon: <FaBook />, page: "/admin/course" },
  { id: 6, label: "Subject Management", icon: <FaClipboardList />, page: "/admin/subjects" },
  { id: 7, label: "Semester Management", icon: <FaChalkboardTeacher />, page: "/admin/semOryear" },
  { id: 8, label: "Schedule Management", icon: <FaCalendarAlt />, page: "/admin/schedule" },
  { id: 9, label: "Leave Request", icon: <LeavePendingIcon className="h-5 w-5" />, page: "/admin/leave" },
  { id: 11, label: "Announcements", icon: <FaBullhorn />, page: "/admin/announcement" },
  { id: 12, label: "Exams & Reports", icon: <FaFileAlt />, page: "/admin/result" },
];

/* ------------------ Sidebar component ------------------ */
export default function Sidebar() {
  const rawPathname = usePathname();
  // ✅ ensure we always have a string, so TS stops complaining
  const pathname = rawPathname ?? "";
  const router = useRouter();

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token_admin");
    }
    router.push("/admin_login");
  };

  return (
    <aside className="fixed top-24 left-0 h-[calc(100vh-6rem)] bg-[#F5F5F5] z-50 text-[#2E3094] group transition-all duration-300 w-20 hover:w-64 overflow-hidden">
      <div className="h-full overflow-y-auto">
        <ul className="space-y-3 px-2 py-4">
          {sidebarItems.map((item) => {
            const isActive =
              item.page === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.page || "");

            return (
              <li key={item.id}>
                <Link
                  href={item.page || ""}
                  className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                    isActive
                      ? "bg-[#2E3094] text-[#F5F5F5]"
                      : "hover:bg-[#e0ec83]"
                  }`}
                >
                  <div className="text-xl">{item.icon}</div>
                  <span className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}

          {/* LOGOUT BUTTON */}
          <li>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 p-2 rounded w-full text-left transition-colors hover:bg-red-500 hover:text-white"
            >
              <div className="text-xl">
                <FaSignOutAlt />
              </div>
              <span className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                Logout
              </span>
            </button>
          </li>
        </ul>
      </div>
    </aside>
  );
}
