'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Bell,
  CheckCircle,
  Clock,
  User,
  Archive,
  Inbox,
  Check,
  X,
  Search,
  Settings,
} from 'lucide-react';
import { useUser } from '@/app/student/dashboard/studentContext';

type NotificationType =
  | 'assignment'
  | 'groupAssignment'
  | 'material'
  | 'quiz'
  | 'question';

type Notification = {
  _id: string;
  courseInstance: string;
  type: string; // 'assignment', 'group-assignment', 'comment', 'announcement', '...-submission'
  refId: string;
  title?: string;
  message?: string;
  createdBy?: { _id: string; username: string } | string;
  createdAt: string;
  recipients?: string[];
  readBy?: string[];
  archivedBy?: string[];
  // Enriched context from backend (e.g. for comments/submissions)
  targetType?: string; // e.g., 'group-assignment'
  targetTitle?: string;
  targetId?: string;
  commentPreview?: string;
};

// Normalize backend types (strip "-submission", map hyphenated to camel-case keys)
function normalizeType(raw?: string): NotificationType | null {
  if (!raw) return null;
  const base = raw.replace(/-submission$/i, '');
  switch (base) {
    case 'assignment':
      return 'assignment';
    case 'group-assignment':
      return 'groupAssignment';
    case 'material':
      return 'material';
    case 'quiz':
      return 'quiz';
    case 'question':
      return 'question';
    default:
      return null;
  }
}

// Identify clicks that started on interactive UI (so we don't navigate)
const isInteractive = (el: HTMLElement | null): boolean => {
  while (el) {
    const tag = el.tagName;
    if (['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT', 'LABEL'].includes(tag))
      return true;
    if (el.getAttribute('role') === 'button') return true;
    el = el.parentElement as HTMLElement | null;
  }
  return false;
};

export default function NotificationsPage() {
  const params = useParams();
  const courseInstanceId = params?.courseInstanceId as string;
  const { user } = useUser();
  const userId = user?._id || (user as any)?.id || '';
  const router = useRouter();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedNotifications, setSelectedNotifications] = useState<
    Set<string>
  >(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'read'>(
    'all'
  );

  // Fetch notifications from backend
  useEffect(() => {
    if (!courseInstanceId || !userId) return;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const token =
          localStorage.getItem('token_student') ||
          sessionStorage.getItem('token_student');
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/notification?courseInstance=${courseInstanceId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );
        if (!res.ok) throw new Error('Failed to fetch notifications');
        const data = await res.json();
        setNotifications(data.notifications || []);
      } catch (e: any) {
        setError(e.message || 'Failed to fetch notifications');
      } finally {
        setLoading(false);
      }
    })();
  }, [courseInstanceId, userId]);

  // Mark single notification as read (optimistic)
  const markAsRead = async (notifId: string) => {
    if (!notifId || !userId) return;
    setNotifications(prev =>
      prev.map(n =>
        n._id === notifId && !n.readBy?.includes(userId)
          ? { ...n, readBy: [...(n.readBy || []), userId] }
          : n
      )
    );
    try {
      const token =
        localStorage.getItem('token_student') ||
        sessionStorage.getItem('token_student');
      await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/notification/${notifId}/mark-read`,
        { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } }
      );
    } catch {
      /* ignore */
    }
  };

  // Navigate based on normalized type + enriched target
  function handleNotificationClick(notif: Notification) {
    // Mark as read when clicked (even if we don't navigate)
    if (!notif.readBy?.includes(userId)) {
      markAsRead(notif._id);
    }

    // Submission notifications are informational only for students
    const isSubmission = /-submission$/i.test(notif.type);
    if (isSubmission) return;

    // Announcements open the course feed, auto-scroll & highlight
    const effectiveType = (notif.targetType || notif.type || '').toLowerCase();
    if (effectiveType === 'announcement') {
      const highlightId = notif.targetId || notif.refId || notif._id;
      router.push(
        `/student/dashboard/class/course-instance/${courseInstanceId}?highlight=${highlightId}&type=announcement`
      );
      return;
    }

    // Everything else → details page route
    const rawType = notif.targetType || notif.type;
    const id = notif.targetId || notif.refId;
    const normalized = normalizeType(rawType);
    if (!normalized || !id) return;

    const routeMap: Record<NotificationType, string> = {
      assignment: 'assignment',
      groupAssignment: 'group-assignments',
      material: 'materials',
      quiz: 'quizzes',
      question: 'questions',
    };

    const route = routeMap[normalized];
    if (!route) return;

    const url =
      notif.type === 'comment' && notif.refId
        ? `/student/dashboard/class/course-instance/${courseInstanceId}/${route}/${id}?commentId=${notif.refId}`
        : `/student/dashboard/class/course-instance/${courseInstanceId}/${route}/${id}`;

    router.push(url);
  }

  // Guarded row click to avoid navigating when clicking interactive controls
  const onRowClick = (
    e: React.MouseEvent<HTMLDivElement>,
    notif: Notification
  ) => {
    if (isInteractive(e.target as HTMLElement)) return;
    handleNotificationClick(notif);
  };

  // Archive or unarchive (optimistic)
  const toggleArchive = async (notifId: string, archive: boolean) => {
    if (!notifId || !userId) return;
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
    try {
      const token =
        localStorage.getItem('token_student') ||
        sessionStorage.getItem('token_student');
      await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/notification/${notifId}/archive`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ archive }),
        }
      );
    } catch {
      /* ignore */
    }
  };

  // Mark all read (optimistic)
  const markAllAsRead = async () => {
    if (!userId) return;
    setNotifications(prev =>
      prev.map(n =>
        !n.readBy?.includes(userId)
          ? { ...n, readBy: [...(n.readBy || []), userId] }
          : n
      )
    );
    try {
      const token =
        localStorage.getItem('token_student') ||
        sessionStorage.getItem('token_student');
      await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/notification/mark-all-read?courseInstance=${courseInstanceId}`,
        { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } }
      );
    } catch {
      /* ignore */
    }
  };

  // Archive all (optimistic)
  const archiveAll = async () => {
    if (!userId) return;
    setNotifications(prev =>
      prev.map(n =>
        !n.archivedBy?.includes(userId)
          ? { ...n, archivedBy: [...(n.archivedBy || []), userId] }
          : n
      )
    );
    try {
      const token =
        localStorage.getItem('token_student') ||
        sessionStorage.getItem('token_student');
      await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/notification/mark-all-archived?courseInstance=${courseInstanceId}`,
        { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } }
      );
    } catch {
      /* ignore */
    }
  };

  // Toggle selection
  const toggleSelection = (notifId: string) => {
    setSelectedNotifications(prev => {
      const next = new Set(prev);
      next.has(notifId) ? next.delete(notifId) : next.add(notifId);
      return next;
    });
  };

  // Bulk actions
  const handleBulkAction = async (action: 'read' | 'archive') => {
    const ids = Array.from(selectedNotifications);
    if (ids.length === 0) return;

    if (action === 'read') {
      await Promise.all(ids.map(id => markAsRead(id)));
    } else {
      await Promise.all(ids.map(id => toggleArchive(id, true)));
    }
    setSelectedNotifications(new Set());
  };

  // Only show notifications the student is a recipient/author of
  const visible = notifications.filter(
    n =>
      ((n.recipients && n.recipients.includes(userId)) ||
        (n.createdBy &&
          (typeof n.createdBy === 'string'
            ? n.createdBy === userId
            : n.createdBy._id === userId)))
  );

  // Apply UI filters/search/archived toggle
  const filtered = visible.filter(n => {
    const matchesArchive = showArchived
      ? n.archivedBy && n.archivedBy.includes(userId)
      : !n.archivedBy || !n.archivedBy.includes(userId);

    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !q ||
      n.title?.toLowerCase().includes(q) ||
      n.message?.toLowerCase().includes(q) ||
      n.targetTitle?.toLowerCase().includes(q);

    const isUnread = !n.readBy?.includes(userId);
    const matchesFilter =
      filterType === 'all' ||
      (filterType === 'unread' && isUnread) ||
      (filterType === 'read' && !isUnread);

    return matchesArchive && matchesSearch && matchesFilter;
  });

  const unreadCount = filtered.filter(n => !n.readBy?.includes(userId)).length;

  // Pretty time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(dateString).toLocaleDateString();
  };

  // Type styling
  const getNotificationStyle = (type: string) => {
    const styles: any = {
      assignment: {
        icon: '📝',
        color: 'bg-blue-100 text-blue-600',
        border: 'border-blue-200',
      },
      grade: {
        icon: '📊',
        color: 'bg-green-100 text-green-600',
        border: 'border-green-200',
      },
      announcement: {
        icon: '📢',
        color: 'bg-purple-100 text-purple-600',
        border: 'border-purple-200',
      },
      reminder: {
        icon: '⏰',
        color: 'bg-orange-100 text-orange-600',
        border: 'border-orange-200',
      },
      comment: {
        icon: '💬',
        color: 'bg-gray-100 text-gray-700',
        border: 'border-gray-200',
      },
      default: {
        icon: '🔔',
        color: 'bg-gray-100 text-gray-600',
        border: 'border-gray-200',
      },
    };
    return styles[type] || styles.default;
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-5 sm:mb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-4 sm:mb-6">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="p-2 sm:p-3 bg-blue-100 rounded-lg flex-shrink-0">
              <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
                Notifications
              </h1>
              <p className="text-xs sm:text-sm text-gray-600">
                Stay updated with your course activities
              </p>
            </div>
            {unreadCount > 0 && (
              <div className="ml-1 sm:ml-2 bg-red-500 text-white text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                {unreadCount}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium text-xs sm:text-sm transition-all ${
                showArchived
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {showArchived ? (
                <Inbox className="w-4 h-4" />
              ) : (
                <Archive className="w-4 h-4" />
              )}
              {showArchived ? 'Active' : 'Archived'}
            </button>
            <button className="p-1.5 sm:p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
              <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Search + filter */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 sm:w-5 sm:h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 sm:pr-4 py-2 text-xs sm:text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterType}
              onChange={e =>
                setFilterType(e.target.value as 'all' | 'unread' | 'read')
              }
              className="w-full sm:w-auto px-3 sm:px-4 py-2 text-xs sm:text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </select>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedNotifications.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-3 sm:mt-4 p-2.5 sm:p-3 bg-blue-50 rounded-lg">
            <span className="text-xs sm:text-sm text-blue-700 font-medium">
              {selectedNotifications.size} selected
            </span>
            <button
              onClick={() => handleBulkAction('read')}
              className="flex items-center gap-1 px-3 py-1 text-xs sm:text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Check className="w-3.5 h-3.5" />
              Mark Read
            </button>
            <button
              onClick={() => handleBulkAction('archive')}
              className="flex items-center gap-1 px-3 py-1 text-xs sm:text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              <Archive className="w-3.5 h-3.5" />
              Archive
            </button>
            <button
              onClick={() => setSelectedNotifications(new Set())}
              className="flex items-center gap-1 px-3 py-1 text-xs sm:text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
          </div>
        )}

        {/* Quick Actions */}
        {!showArchived && unreadCount > 0 && selectedNotifications.size === 0 && (
          <div className="flex flex-wrap gap-2 mt-3 sm:mt-4">
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 text-xs sm:text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Mark all read
            </button>
            <button
              onClick={archiveAll}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 text-xs sm:text-sm bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors"
            >
              <Archive className="w-3.5 h-3.5" />
              Archive all
            </button>
          </div>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-8 sm:p-12 text-center">
          <div className="animate-spin w-7 h-7 sm:w-8 sm:h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600 text-sm sm:text-base">
            Loading notifications...
          </p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl shadow-sm p-8 sm:p-12 text-center">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
            <X className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
          </div>
          <p className="text-red-600 font-medium text-sm sm:text-base">
            Error loading notifications
          </p>
          <p className="text-gray-600 text-xs sm:text-sm mt-1">{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 sm:p-12 text-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
            <Bell className="w-7 h-7 sm:w-8 sm:h-8 text-gray-400" />
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1 sm:mb-2">
            {showArchived
              ? 'No archived notifications'
              : "You're all caught up!"}
          </h3>
          <p className="text-gray-600 text-sm">
            {showArchived
              ? 'Your archived notifications will appear here.'
              : 'No new notifications at the moment.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {filtered.map(notif => {
            const isUnread = !notif.readBy?.includes(userId);
            const isArchived = !!notif.archivedBy?.includes(userId);
            const isSelected = selectedNotifications.has(notif._id);
            const style = getNotificationStyle(notif.type);
            const isComment = notif.type === 'comment';
            const creator =
              typeof notif.createdBy === 'object'
                ? notif.createdBy.username
                : notif.createdBy;

            return (
              <div
                key={notif._id}
                onClick={e => onRowClick(e, notif)}
                className={`cursor-pointer bg-white rounded-xl shadow-sm border-2 transition-all hover:shadow-md ${
                  isUnread
                    ? 'border-blue-200 bg-gradient-to-r from-blue-50 to-white'
                    : 'border-gray-100'
                } ${isSelected ? 'ring-2 ring-blue-500' : ''} ${
                  isArchived ? 'opacity-70' : ''
                }`}
              >
                <div className="p-4 sm:p-6">
                  <div className="flex items-start gap-3 sm:gap-4">
                    {/* Selection checkbox */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onClick={e => e.stopPropagation()}
                      onChange={e => {
                        e.stopPropagation();
                        toggleSelection(notif._id);
                      }}
                      className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500 flex-shrink-0"
                      aria-label="Select notification"
                    />

                    {/* Notification type icon */}
                    <div
                      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-base sm:text-lg flex-shrink-0 ${style.color}`}
                    >
                      {style.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-1.5 sm:mb-2">
                        <div className="flex items-start gap-2 sm:gap-3">
                          <h3
                            className={`font-semibold text-sm sm:text-base ${
                              isUnread ? 'text-gray-900' : 'text-gray-700'
                            }`}
                          >
                            {isComment &&
                            creator &&
                            notif.targetType &&
                            notif.targetTitle
                              ? `${creator} commented on ${capitalize(
                                  notif.targetType
                                )}: "${notif.targetTitle}"`
                              : notif.title || notif.type}
                          </h3>
                          {isUnread && (
                            <div className="mt-1 w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                          )}
                        </div>
                        <span
                          className={`inline-flex items-center justify-center px-2 py-0.5 text-[10px] sm:text-xs font-medium rounded-full ${style.color} ${style.border} border whitespace-nowrap`}
                        >
                          {notif.type}
                        </span>
                      </div>

                      {!isComment && notif.message && (
                        <p className="text-gray-600 text-xs sm:text-sm mb-2">
                          {notif.message}
                        </p>
                      )}

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-3 text-[11px] sm:text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(notif.createdAt)}
                          </div>
                          {creator && (
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              <span className="truncate max-w-[140px] sm:max-w-none">
                                {creator}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 sm:gap-2 self-end sm:self-center">
                          {!isUnread && (
                            <CheckCircle className="w-4 h-4 text-green-500 hidden xs:inline-block" />
                          )}
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              if (isUnread) markAsRead(notif._id);
                            }}
                            className={`p-1.5 rounded-md transition-colors ${
                              isUnread
                                ? 'text-blue-600 hover:bg-blue-100'
                                : 'text-gray-400'
                            }`}
                            disabled={!isUnread}
                            aria-label="Mark as read"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              toggleArchive(notif._id, !isArchived);
                            }}
                            className={`p-1.5 rounded-md transition-colors ${
                              isArchived
                                ? 'text-blue-600 hover:bg-blue-100'
                                : 'text-gray-600 hover:bg-gray-100'
                            }`}
                            aria-label={isArchived ? 'Unarchive' : 'Archive'}
                          >
                            {isArchived ? (
                              <Inbox className="w-4 h-4" />
                            ) : (
                              <Archive className="w-4 h-4" />
                            )}
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
        <div className="mt-6 sm:mt-8 p-3 sm:p-4 bg-white rounded-xl shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs sm:text-sm text-gray-600">
            <div>
              Showing {filtered.length} of {visible.length} notifications
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span>
                {filtered.filter(n => !n.readBy?.includes(userId)).length}{' '}
                unread
              </span>
              <span className="hidden sm:inline">•</span>
              <span>
                {visible.filter(n => n.archivedBy?.includes(userId)).length}{' '}
                archived
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper for capitalizing a type label for display
function capitalize(str?: string) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
