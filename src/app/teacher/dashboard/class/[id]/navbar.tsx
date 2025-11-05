"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
// If your project already has teacherContext, keep this import and path correct.
// If not, set userId to an empty string or your own auth source.
import { useUser } from "../../teacherContext"; // <-- adjust path if needed

const TABS = ["Class", "workspace", "People", "Grades", "Notifications", "Attendance"];

export default function CourseNavbar() {
  const rawPathname = usePathname();
  // ✅ Make pathname always a string to satisfy TS
  const pathname = rawPathname ?? "";

  const parts = useMemo(() => pathname.split("/"), [pathname]);

  // /teacher/dashboard/class/[id]/[tab?]
  const classId = parts[4];
  const currentTab = parts[5] ?? "class";

  let ctx: any = null;
  try {
    ctx = useUser();
  } catch {
    ctx = { user: null };
  }
  const user = ctx?.user ?? null;
  const userId: string = (user && (user._id ?? (user as any)?.id)) || "";

  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchUnread = async () => {
    if (!classId || !userId) return;
    try {
      setLoading(true);
      const token =
        (typeof window !== "undefined" &&
          (localStorage.getItem("token_teacher") ||
            sessionStorage.getItem("token_teacher"))) ||
        "";

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/notification?courseInstance=${classId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error("Failed to fetch notifications");
      const data = await res.json();

      const list: any[] = Array.isArray(data?.notifications)
        ? data.notifications
        : [];
      const count = list.filter((n) => {
        const readBy = Array.isArray(n?.readBy) ? n.readBy : [];
        const archivedBy = Array.isArray(n?.archivedBy) ? n.archivedBy : [];
        const isUnread = userId ? !readBy.includes(userId) : false;
        const isArchived = userId ? archivedBy.includes(userId) : false;
        return isUnread && !isArchived;
      }).length;

      setUnreadCount(count);
    } catch {
      // ignore errors
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnread();
    const handler = () => fetchUnread();
    if (typeof window !== "undefined") {
      window.addEventListener("notif:changed", handler);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("notif:changed", handler);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, userId]);

  return (
    <nav className="w-full border-b border-gray-200 px-6 py-3 bg-white shadow-sm">
      <ul className="flex space-x-8">
        {TABS.map((tab) => {
          const tabSlug = tab.toLowerCase();
          const path =
            tabSlug === "class"
              ? `/teacher/dashboard/class/${classId}`
              : `/teacher/dashboard/class/${classId}/${tabSlug}`;

          const isActive =
            currentTab === tabSlug || (!currentTab && tabSlug === "class");

          const isNotifications = tabSlug === "notifications";
          const showDot = unreadCount > 0;
          const displayCount =
            unreadCount > 99 ? "99+" : unreadCount.toString();

          return (
            <li key={tab} className="relative">
              <Link
                href={path}
                className={`text-lg font-medium transition ${
                  isActive
                    ? "text-blue-700 border-b-2 border-blue-700 pb-1"
                    : "text-gray-700 hover:text-blue-600"
                }`}
              >
                {tab}
              </Link>

              {isNotifications && showDot && (
                <span
                  className="absolute -top-3 -right-6 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-500 text-white shadow"
                  title={`${unreadCount} unread`}
                >
                  {displayCount}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
