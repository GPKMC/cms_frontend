'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Bell, CheckCircle, Clock, User, Archive, Inbox,
  MoreVertical, Check, X, Search, Settings
} from 'lucide-react';
import { useUser } from '@/app/student/dashboard/studentContext';
type NotificationType = "assignment" | "groupAssignment" | "material" | "quiz" | "question";

type Notification = {
  _id: string;
  courseInstance: string;
  type: string;
  refId: string;
  title?: string;
  message?: string;
  createdBy?: { _id: string; username: string } | string;
  createdAt: string;
  recipients?: string[];
  readBy?: string[];
  archivedBy?: string[];
  // Comment context (for comment notifications)
  targetType?: string;
  targetTitle?: string;
  targetId?: string;
  commentPreview?: string;
};

export default function NotificationsPage() {
  const params = useParams();
  const courseInstanceId = params?.courseInstanceId as string;
  const { user } = useUser();
  const userId = user?._id || user?.id || '';

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'read'>('all');
  const router = useRouter();
  // Fetch notifications from backend
  useEffect(() => {
    if (!courseInstanceId || !userId) return;
    setLoading(true);
    setError(null);
    const token =
      localStorage.getItem("token_student") ||
      sessionStorage.getItem("token_student");
    fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/notification?courseInstance=${courseInstanceId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    )
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to fetch notifications');
        const data = await res.json();
        setNotifications(data.notifications || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [courseInstanceId, userId]);

  // Mark single notification as read
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
        localStorage.getItem("token_student") ||
        sessionStorage.getItem("token_student");
      await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/notification/${notifId}/mark-read`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` }
        }
      );
    } catch { }
  };


function handleNotificationClick(notif: Notification) {
  if (!notif.readBy?.includes(userId)) {
    markAsRead(notif._id);
  }

  let type = notif.type;
  let id = notif.refId;

  // For comment notifications, use targetType/targetId if present
  if (notif.type === "comment" && notif.targetType && notif.targetId) {
    type = notif.targetType;
    id = notif.targetId;
  }

  // Declare the map OUTSIDE of the push!
  const typeMetaMap: Record<NotificationType, string> = {
    assignment: "assignment",
    groupAssignment: "group-assignments",
    material: "materials",
    quiz: "quizzes",
    question: "questions",
  };

  // Assign before use
  const route = typeMetaMap[type as NotificationType];
  if (!route || !id) return;

  // Now it's safe to use!
  router.push(
    notif.type === "comment" && notif.refId
      ? `/student/dashboard/class/course-instance/${courseInstanceId}/${route}/${id}?commentId=${notif.refId}`
      : `/student/dashboard/class/course-instance/${courseInstanceId}/${route}/${id}`
  );
}


  // Archive or unarchive notification
  const toggleArchive = async (notifId: string, archive: boolean) => {
    if (!notifId || !userId) return;
    setNotifications(prev =>
      prev.map(n =>
        n._id === notifId
          ? {
            ...n,
            archivedBy: archive
              ? [...(n.archivedBy || []), userId]
              : (n.archivedBy || []).filter(id => id !== userId)
          }
          : n
      )
    );
    try {
      const token =
        localStorage.getItem("token_student") ||
        sessionStorage.getItem("token_student");
      await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/notification/${notifId}/archive`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ archive })
        }
      );
    } catch { }
  };

  // Mark all as read
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
        localStorage.getItem("token_student") ||
        sessionStorage.getItem("token_student");
      await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/notification/mark-all-read?courseInstance=${courseInstanceId}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` }
        }
      );
    } catch { }
  };

  // Archive all
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
        localStorage.getItem("token_student") ||
        sessionStorage.getItem("token_student");
      await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/notification/mark-all-archived?courseInstance=${courseInstanceId}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` }
        }
      );
    } catch { }
  };

  // Toggle notification selection
  const toggleSelection = (notifId: string) => {
    setSelectedNotifications(prev => {
      const newSet = new Set(prev);
      if (newSet.has(notifId)) {
        newSet.delete(notifId);
      } else {
        newSet.add(notifId);
      }
      return newSet;
    });
  };

  // Handle bulk actions
  const handleBulkAction = async (action: 'read' | 'archive') => {
    const selected = Array.from(selectedNotifications);
    if (selected.length === 0) return;

    if (action === 'read') {
      selected.forEach(id => markAsRead(id));
    } else if (action === 'archive') {
      selected.forEach(id => toggleArchive(id, true));
    }
    setSelectedNotifications(new Set());
  };

  // Filter notifications
  const visible = notifications.filter(
    (n) =>
    ((n.recipients && n.recipients.includes(userId)) ||
      (n.createdBy && (typeof n.createdBy === 'string'
        ? n.createdBy === userId
        : n.createdBy._id === userId)))
  );

  const filtered = visible.filter(n => {
    const matchesArchive = showArchived
      ? n.archivedBy && n.archivedBy.includes(userId)
      : !n.archivedBy || !n.archivedBy.includes(userId);

    const matchesSearch = searchTerm === '' ||
      n.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.message?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = filterType === 'all' ||
      (filterType === 'unread' && !n.readBy?.includes(userId)) ||
      (filterType === 'read' && n.readBy?.includes(userId));

    return matchesArchive && matchesSearch && matchesFilter;
  });

  // Format time
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
    return date.toLocaleDateString();
  };

  // Get notification type icon and color
  const getNotificationStyle = (type: string) => {
    const styles = {
      assignment: { icon: '📝', color: 'bg-blue-100 text-blue-600', border: 'border-blue-200' },
      grade: { icon: '📊', color: 'bg-green-100 text-green-600', border: 'border-green-200' },
      announcement: { icon: '📢', color: 'bg-purple-100 text-purple-600', border: 'border-purple-200' },
      reminder: { icon: '⏰', color: 'bg-orange-100 text-orange-600', border: 'border-orange-200' },
      comment: { icon: '💬', color: 'bg-gray-100 text-gray-700', border: 'border-gray-200' },
      default: { icon: '🔔', color: 'bg-gray-100 text-gray-600', border: 'border-gray-200' }
    };
    return styles[type as keyof typeof styles] || styles.default;
  };

  const unreadCount = filtered.filter(n => !n.readBy?.includes(userId)).length;

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
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${showArchived
                ? 'bg-blue-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
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
              onChange={(e) => setFilterType(e.target.value as 'all' | 'unread' | 'read')}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </select>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedNotifications.size > 0 && (
          <div className="flex items-center gap-3 mt-4 p-3 bg-blue-50 rounded-lg">
            <span className="text-sm text-blue-700 font-medium">
              {selectedNotifications.size} selected
            </span>
            <button
              onClick={() => handleBulkAction('read')}
              className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
            >
              <Check className="w-4 h-4" />
              Mark Read
            </button>
            <button
              onClick={() => handleBulkAction('archive')}
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

        {/* Quick Actions */}
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

      {/* Notifications List */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
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
            const isUnread = !notif.readBy?.includes(userId);
            const isArchived = notif.archivedBy && notif.archivedBy.includes(userId);
            const isSelected = selectedNotifications.has(notif._id);
            const style = getNotificationStyle(notif.type);

            // --- Custom rendering for comment notifications
            const isComment = notif.type === "comment";
            const creator =
              typeof notif.createdBy === "object"
                ? notif.createdBy.username
                : notif.createdBy;

            return (
              <div
                key={notif._id}
                onClick={() => handleNotificationClick(notif)}
                className={`cursor-pointer bg-white rounded-xl shadow-sm border-2 transition-all hover:shadow-md ${isUnread ? 'border-blue-200 bg-gradient-to-r from-blue-50 to-white' : 'border-gray-100'
                  } ${isSelected ? 'ring-2 ring-blue-500' : ''} ${isArchived ? 'opacity-70' : ''}`}
              >
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    {/* Selection checkbox */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelection(notif._id)}
                      className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />

                    {/* Notification type icon */}
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${style.color}`}>
                      {style.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <h3 className={`font-semibold ${isUnread ? 'text-gray-900' : 'text-gray-700'}`}>
                            {isComment && creator && notif.targetType && notif.targetTitle
                              ? `${creator} commented on ${capitalize(notif.targetType)}: "${notif.targetTitle}"`
                              : notif.title || notif.type}
                          </h3>
                          {isUnread && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          )}
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${style.color} ${style.border} border`}>
                          {notif.type}
                        </span>
                      </div>

                      {/* Show comment snippet for comment notifications */}
                      {/* {isComment && notif.commentPreview && (
                        <div
                          className="bg-gray-50 rounded px-3 py-2 text-sm text-gray-700 mb-2 border-l-4 border-blue-200 announcement-content"
                          dangerouslySetInnerHTML={{ __html: notif.commentPreview }}
                        />
                      )} */}

                      {/* Fallback: normal message */}
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
                          {!isUnread && (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isUnread) markAsRead(notif._id);
                            }}
                            className={`p-1 rounded-md transition-colors ${isUnread
                              ? 'text-blue-600 hover:bg-blue-100'
                              : 'text-gray-400'
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
                            className={`p-1 rounded-md transition-colors ${isArchived
                              ? 'text-blue-600 hover:bg-blue-100'
                              : 'text-gray-600 hover:bg-gray-100'
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
              <span>{unreadCount} unread</span>
              <span>•</span>
              <span>{visible.filter(n => n.archivedBy?.includes(userId)).length} archived</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper for capitalizing type
function capitalize(str?: string) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
