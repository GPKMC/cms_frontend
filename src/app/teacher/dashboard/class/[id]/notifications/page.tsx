"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Bell, CheckCircle, Clock, User, Archive, Inbox,
  Check, X, Search, Settings
} from "lucide-react";
import { useUser } from "../../../teacherContext";

/* =======================
   Types
======================= */
type NotificationType =
  | "assignment"
  | "groupAssignment"
  | "material"
  | "quiz"
  | "question"
  | "announcement";

type Notification = {
  _id: string;
  courseInstance: string;
  type: string;                  // 'assignment','group-assignment','comment','...-submission','announcement'
  refId: string;
  title?: string;
  message?: string;
  createdBy?: { _id: string; username: string } | string;
  createdAt: string;
  recipients?: string[];
  readBy?: string[];
  archivedBy?: string[];
  targetType?: string;           // enriched type (may be hyphenated)
  targetTitle?: string;
  targetId?: string;
  commentPreview?: string;
};

/* =======================
   Helpers
======================= */
function normalizeType(raw?: string): NotificationType | null {
  if (!raw) return null;
  const base = raw.replace(/-submission$/i, "");
  switch (base) {
    case "assignment": return "assignment";
    case "group-assignment": return "groupAssignment";
    case "material": return "material";
    case "quiz": return "quiz";
    case "question": return "question";
    case "announcement": return "announcement";
    default: return null;
  }
}

const isInteractive = (el: HTMLElement | null): boolean => {
  while (el) {
    const tag = el.tagName;
    if (["BUTTON", "A", "INPUT", "TEXTAREA", "SELECT", "LABEL"].includes(tag)) return true;
    if (el.getAttribute("role") === "button") return true;
    el = el.parentElement as HTMLElement | null;
  }
  return false;
};

// Let the navbar know counts changed
function notifyNavbar() {
  try {
    window.dispatchEvent(new Event("notif:changed"));
  } catch {}
}

function capitalize(str?: string) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default function NotificationsPage() {
  const params = useParams();
  const courseInstanceId = params?.id as string; // /class/[id]
  const { user } = useUser();
  const userId = user?._id || (user as any)?.id || "";
  const router = useRouter();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "unread" | "read">("all");

  // Fetch
  useEffect(() => {
    if (!courseInstanceId) return;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const token =
          localStorage.getItem("token_teacher") ||
          sessionStorage.getItem("token_teacher") ||
          "";
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/notification?courseInstance=${courseInstanceId}`,
          { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
        );
        if (!res.ok) throw new Error("Failed to fetch notifications");
        const data = await res.json();
        setNotifications(Array.isArray(data?.notifications) ? data.notifications : []);
      } catch (e: any) {
        setError(e?.message || "Failed to fetch notifications");
      } finally {
        setLoading(false);
      }
    })();
  }, [courseInstanceId]);

  // Mark single read (optimistic)
  const markAsRead = async (notifId: string) => {
    if (!notifId) return;
    if (userId) {
      setNotifications(prev =>
        prev.map(n =>
          n._id === notifId && !n.readBy?.includes(userId)
            ? { ...n, readBy: [...(n.readBy || []), userId] }
            : n
        )
      );
      notifyNavbar();
    }
    try {
      const token =
        localStorage.getItem("token_teacher") ||
        sessionStorage.getItem("token_teacher") ||
        "";
      await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/notification/${notifId}/mark-read`,
        { method: "PATCH", headers: { Authorization: `Bearer ${token}` } }
      );
      notifyNavbar();
    } catch {}
  };

  // Navigate from a notification
  function handleNotificationClick(notif: Notification) {
    if (userId && !notif.readBy?.includes(userId)) {
      markAsRead(notif._id);
    }

    const rawType = notif.targetType || notif.type;
    const id = notif.targetId || notif.refId;
    const normalized = normalizeType(rawType);
    if (!normalized || !id) return;

    if (normalized === "announcement") {
      router.push(`/teacher/dashboard/class/${courseInstanceId}?highlight=${id}&type=announcement`);
      return;
    }

    const routeMap: Record<Exclude<NotificationType, "announcement">, string> = {
      assignment: "Assignment",
      groupAssignment: "groupAssignment",
      material: "materials",
      quiz: "quizzes",
      question: "Question",
    };

    const route = (routeMap as any)[normalized];
    if (!route) return;

    const base = `/teacher/dashboard/class/${courseInstanceId}/Details/${route}/${id}`;
    const isSubmission = /-submission$/i.test(notif.type);

    const url = isSubmission
      ? `${base}?tab=answer`
      : (notif.type === "comment" && notif.refId)
        ? `${base}?commentId=${notif.refId}`
        : base;

    router.push(url);
  }

  const onRowClick = (e: React.MouseEvent<HTMLDivElement>, notif: Notification) => {
    if (isInteractive(e.target as HTMLElement)) return;
    handleNotificationClick(notif);
  };

  // Archive / Unarchive (optimistic)
  const toggleArchive = async (notifId: string, archive: boolean) => {
    if (!notifId) return;
    if (userId) {
      setNotifications(prev =>
        prev.map(n =>
          n._id === notifId
            ? {
                ...n,
                archivedBy: archive
                  ? [...(n.archivedBy || []), userId]
                  : (n.archivedBy || []).filter(id => id !== userId),
              }
            : n
        )
      );
      notifyNavbar();
    }
    try {
      const token =
        localStorage.getItem("token_teacher") ||
        sessionStorage.getItem("token_teacher") ||
        "";
      await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/notification/${notifId}/archive`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ archive }),
        }
      );
      notifyNavbar();
    } catch {}
  };

  // Bulk actions
  const handleBulkAction = async (action: "read" | "archive") => {
    const ids = Array.from(selectedNotifications);
    if (!ids.length) return;

    if (action === "read") {
      await Promise.all(ids.map((id) => markAsRead(id)));
    } else {
      await Promise.all(ids.map((id) => toggleArchive(id, true)));
    }
    setSelectedNotifications(new Set());
  };

  // Mark all read
  const markAllAsRead = async () => {
    if (userId) {
      setNotifications(prev =>
        prev.map(n =>
          !n.readBy?.includes(userId)
            ? { ...n, readBy: [...(n.readBy || []), userId] }
            : n
        )
      );
      notifyNavbar();
    }
    try {
      const token =
        localStorage.getItem("token_teacher") ||
        sessionStorage.getItem("token_teacher") ||
        "";
      await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/notification/mark-all-read?courseInstance=${courseInstanceId}`,
        { method: "PATCH", headers: { Authorization: `Bearer ${token}` } }
      );
      notifyNavbar();
    } catch {}
  };

  // Archive all
  const archiveAll = async () => {
    if (userId) {
      setNotifications(prev =>
        prev.map(n =>
          !n.archivedBy?.includes(userId)
            ? { ...n, archivedBy: [...(n.archivedBy || []), userId] }
            : n
        )
      );
      notifyNavbar();
    }
    try {
      const token =
        localStorage.getItem("token_teacher") ||
        sessionStorage.getItem("token_teacher") ||
        "";
      await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/notification/mark-all-archived?courseInstance=${courseInstanceId}`,
        { method: "PATCH", headers: { Authorization: `Bearer ${token}` } }
      );
      notifyNavbar();
    } catch {}
  };

  // Selection
  const toggleSelection = (notifId: string) => {
    setSelectedNotifications(prev => {
      const next = new Set(prev);
      next.has(notifId) ? next.delete(notifId) : next.add(notifId);
      return next;
    });
  };

  // Visible subset
  const visible = notifications;

  // Filters & search
  const filtered = visible.filter(n => {
    const matchesArchive = showArchived
      ? (userId ? !!n.archivedBy?.includes(userId) : false)
      : !userId || !n.archivedBy || !n.archivedBy.includes(userId);

    const q = searchTerm.toLowerCase();
    const matchesSearch =
      !q ||
      (n.title && n.title.toLowerCase().includes(q)) ||
      (n.message && n.message.toLowerCase().includes(q)) ||
      (n.targetTitle && n.targetTitle.toLowerCase().includes(q));

    const isUnread = userId ? !n.readBy?.includes(userId) : false;
    const matchesFilter =
      filterType === "all" ||
      (filterType === "unread" && isUnread) ||
      (filterType === "read" && !isUnread);

    return matchesArchive && matchesSearch && matchesFilter;
  });

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getNotificationStyle = (type: string) => {
    const styles: any = {
      assignment: { icon: "📝", color: "bg-blue-100 text-blue-600", border: "border-blue-200" },
      grade: { icon: "📊", color: "bg-green-100 text-green-600", border: "border-green-200" },
      announcement: { icon: "📢", color: "bg-purple-100 text-purple-600", border: "border-purple-200" },
      reminder: { icon: "⏰", color: "bg-orange-100 text-orange-600", border: "border-orange-200" },
      comment: { icon: "💬", color: "bg-gray-100 text-gray-700", border: "border-gray-200" },
      default: { icon: "🔔", color: "bg-gray-100 text-gray-600", border: "border-gray-200" },
    };
    return styles[type] || styles.default;
  };

  const unreadCount = filtered.filter(n => userId && !n.readBy?.includes(userId)).length;

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Bell className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
              <p className="text-gray-600 text-sm">Stay updated with your course activities</p>
            </div>
            {unreadCount > 0 && (
              <div className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                {unreadCount}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                showArchived ? "bg-blue-500 text-white shadow-md" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {showArchived ? <Inbox className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
              {showArchived ? "Active" : "Archived"}
            </button>
            <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as "all" | "unread" | "read")}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </select>
          </div>
        </div>

        {/* Bulk actions */}
        {selectedNotifications.size > 0 && (
          <div className="flex items-center gap-3 mt-4 p-3 bg-blue-50 rounded-lg">
            <span className="text-sm text-blue-700 font-medium">
              {selectedNotifications.size} selected
            </span>
            <button
              onClick={() => handleBulkAction("read")}
              className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
            >
              <Check className="w-4 h-4" />
              Mark Read
            </button>
            <button
              onClick={() => handleBulkAction("archive")}
              className="flex items-center gap-1 px-3 py-1 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700"
            >
              <Archive className="w-4 h-4" />
              Archive
            </button>
            <button
              onClick={() => setSelectedNotifications(new Set())}
              className="flex items-center gap-1 px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        )}

        {/* Quick actions */}
        {!showArchived && unreadCount > 0 && (
          <div className="flex gap-2 mt-4">
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 text-sm rounded-lg hover:bg-green-200 transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Mark all read
            </button>
            <button
              onClick={archiveAll}
              className="flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-700 text-sm rounded-lg hover:bg-orange-200 transition-colors"
            >
              <Archive className="w-4 h-4" />
              Archive all
            </button>
          </div>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Loading notifications...</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-6 h-6 text-red-600" />
          </div>
          <p className="text-red-600 font-medium">Error loading notifications</p>
          <p className="text-gray-600 text-sm mt-1">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bell className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {showArchived ? "No archived notifications" : "You're all caught up!"}
          </h3>
          <p className="text-gray-600">
            {showArchived ? "Your archived notifications will appear here." : "No new notifications at the moment."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((notif) => {
            const isUnread = userId ? !notif.readBy?.includes(userId) : false;
            const isArchived = userId ? !!notif.archivedBy?.includes(userId) : false;
            const isSelected = selectedNotifications.has(notif._id);
            const style = getNotificationStyle(notif.type);

            const isComment = notif.type === "comment";
            const creator =
              typeof notif.createdBy === "object"
                ? notif.createdBy.username
                : notif.createdBy;

            return (
              <div
                key={notif._id}
                onClick={(e) => onRowClick(e, notif)}
                className={`cursor-pointer bg-white rounded-xl shadow-sm border-2 transition-all hover:shadow-md ${
                  isUnread ? "border-blue-200 bg-gradient-to-r from-blue-50 to-white" : "border-gray-100"
                } ${isSelected ? "ring-2 ring-blue-500" : ""} ${isArchived ? "opacity-70" : ""}`}
              >
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleSelection(notif._id);
                      }}
                      className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />

                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${style.color}`}>
                      {style.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <h3 className={`font-semibold ${isUnread ? "text-gray-900" : "text-gray-700"}`}>
                            {isComment && creator && notif.targetType && notif.targetTitle
                              ? `${creator} commented on ${capitalize(notif.targetType)}: "${notif.targetTitle}"`
                              : (notif.title || notif.type)}
                          </h3>
                          {isUnread && <div className="w-2 h-2 bg-blue-500 rounded-full" />}
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${style.color} ${style.border} border`}>
                          {notif.type}
                        </span>
                      </div>

                      {!isComment && (
                        <p className="text-gray-600 mb-2">{notif.message}</p>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(notif.createdAt)}
                          </div>
                          {creator && (
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {creator}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {!isUnread && <CheckCircle className="w-4 h-4 text-green-500" />}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isUnread) markAsRead(notif._id);
                            }}
                            className={`p-1 rounded-md transition-colors ${
                              isUnread ? "text-blue-600 hover:bg-blue-100" : "text-gray-400"
                            }`}
                            disabled={!isUnread}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleArchive(notif._id, !isArchived);
                            }}
                            className={`p-1 rounded-md transition-colors ${
                              isArchived ? "text-blue-600 hover:bg-blue-100" : "text-gray-600 hover:bg-gray-100"
                            }`}
                          >
                            {isArchived ? <Inbox className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Stats */}
      {filtered.length > 0 && (
        <div className="mt-8 p-4 bg-white rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div>
              Showing {filtered.length} of {visible.length} notifications
            </div>
            <div className="flex items-center gap-4">
              <span>{filtered.filter(n => userId && !n.readBy?.includes(userId)).length} unread</span>
              <span>•</span>
              <span>{visible.filter(n => userId && n.archivedBy?.includes(userId)).length} archived</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
