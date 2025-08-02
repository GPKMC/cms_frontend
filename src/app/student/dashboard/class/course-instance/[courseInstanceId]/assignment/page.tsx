"use client";
import React, { JSX, useEffect, useState } from "react";
import {
    FileText, Users, Star, MessageCircle, Calendar, User,
    ChevronDown, Filter, Search, Clock, Target, Bookmark,
    ArrowRight, TrendingUp, BookOpen, Award, CheckCircle2,
    AlertCircle, Play, Download
} from "lucide-react";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";

// Types
type FeedType = "assignment" | "groupAssignment" | "quiz" | "question";
interface UserMini { _id: string; username: string; role?: string; }
interface TopicMini { _id: string; title: string; }
interface FeedItem {
    _id: string;
    type: FeedType;
    title: string;
    content?: string;
    postedBy?: UserMini;
    topic?: TopicMini | null;
    createdAt: string;
    updatedAt: string;
    dueDate?: string;
    points?: number;
    documents?: { url: string; originalname?: string }[];
    media?: { url: string; originalname?: string }[];
    youtubeLinks?: string[];
    links?: string[];
    groups?: any[];
    questions?: any[];
    status?: "upcoming" | "active" | "completed" | "overdue";
    progress?: number;
}

const iconMap: Record<FeedType, { icon: JSX.Element; color: string; bg: string }> = {
    assignment: { icon: <FileText className="w-5 h-5" />, color: "text-blue-600", bg: "bg-blue-100" },
    groupAssignment: { icon: <Users className="w-5 h-5" />, color: "text-violet-600", bg: "bg-violet-100" },
    quiz: { icon: <Star className="w-5 h-5" />, color: "text-yellow-600", bg: "bg-yellow-100" },
    question: { icon: <MessageCircle className="w-5 h-5" />, color: "text-green-600", bg: "bg-green-100" }
};

const typeLabel: Record<FeedType, string> = {
    assignment: "Assignment",
    groupAssignment: "Group Project",
    quiz: "Quiz",
    question: "Discussion"
};

const statusConfig = {
    upcoming: { color: "text-orange-600", bg: "bg-orange-100", icon: <Clock className="w-3 h-3" /> },
    active: { color: "text-blue-600", bg: "bg-blue-100", icon: <Play className="w-3 h-3" /> },
    completed: { color: "text-green-600", bg: "bg-green-100", icon: <CheckCircle2 className="w-3 h-3" /> },
    overdue: { color: "text-red-600", bg: "bg-red-100", icon: <AlertCircle className="w-3 h-3" /> }
};

function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function getDaysUntilDue(dueDate?: string) {
    if (!dueDate) return null;
    const due = new Date(dueDate);
    const now = new Date();
    const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
}

export default function CourseTaskFeed() {
    const params = useParams();
    const courseInstanceId = params.courseInstanceId as string;

    const [feed, setFeed] = useState<FeedItem[]>([]);
    const [topics, setTopics] = useState<TopicMini[]>([]);
    const [selectedTopic, setSelectedTopic] = useState<string>("");
    const [searchTerm, setSearchTerm] = useState("");
    const [showAll, setShowAll] = useState<Record<string, boolean>>({});
    const [typeFilter, setTypeFilter] = useState<Record<FeedType, boolean>>({
        assignment: true, groupAssignment: true, quiz: true, question: true
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    // Fetch topics for filter
    useEffect(() => {
        if (!courseInstanceId) return;
        fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/topic-api/course/${courseInstanceId}`, {
            headers: {
                Authorization:
                    "Bearer " +
                    (localStorage.getItem("token_student") ||
                        sessionStorage.getItem("token_student") ||
                        "")
            }
        })
            .then((r) => r.ok ? r.json() : Promise.reject("Failed to fetch topics"))
            .then((data) => setTopics(data.topics || data))
            .catch(() => setTopics([]));
    }, [courseInstanceId]);

    // Fetch feed
    useEffect(() => {
        if (!courseInstanceId) return;
        setLoading(true);
        setError(null);

        let url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/student/feed/${courseInstanceId}`;
        if (selectedTopic) url += `?topic=${selectedTopic}`;

        fetch(url, {
            headers: {
                Authorization:
                    "Bearer " +
                    (localStorage.getItem("token_student") ||
                        sessionStorage.getItem("token_student") ||
                        ""),
            }
        })
            .then((r) => r.ok ? r.json() : Promise.reject("Could not fetch feed"))
            .then((data) => setFeed(data))
            .catch((err) => setError(err.message || err))
            .finally(() => setLoading(false));
    }, [courseInstanceId, selectedTopic]);

    // Apply filters
    let filteredFeed = feed.filter((item) => typeFilter[item.type]);
    if (searchTerm) {
        filteredFeed = filteredFeed.filter(item =>
            item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.content?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    // Group by topic
    const grouped: Record<string, FeedItem[]> = {};
    filteredFeed.forEach((item) => {
        const topicTitle = item.topic?.title || "Uncategorized";
        if (!grouped[topicTitle]) grouped[topicTitle] = [];
        grouped[topicTitle].push(item);
    });

    // Stats (from all fetched feed, not just filtered)
    const stats = {
        total: feed.length,
        assignments: feed.filter(f => f.type === 'assignment').length,
        quizzes: feed.filter(f => f.type === 'quiz').length,
        discussions: feed.filter(f => f.type === 'question').length,
        active: feed.filter(f => f.status === 'active').length
    };

    // ...rest of your code

    function getDetailUrl(item: FeedItem, courseInstanceId: string) {
        switch (item.type) {
            case "assignment":
                return `/student/dashboard/class/course-instance/${courseInstanceId}/assignment/${item._id}`;
            case "groupAssignment":
                return `/student/dashboard/class/course-instance/${courseInstanceId}/group-assignments/${item._id}`;
            case "quiz":
                return `/student/dashboard/class/course-instance/${courseInstanceId}/quizzes/${item._id}`;
            case "question":
                return `/student/dashboard/class/course-instance/${courseInstanceId}/questions/${item._id}`;
            default:
                return "#";
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
            <div className="max-w-5xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                            <TrendingUp className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Course Feed</h1>
                            <p className="text-gray-600">Stay updated with assignments, quizzes, and discussions</p>
                        </div>
                    </div>
                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
                        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                            <div className="flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-gray-600" />
                                <span className="text-sm text-gray-600">Total</span>
                            </div>
                            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                            <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-blue-600" />
                                <span className="text-sm text-gray-600">Assignments</span>
                            </div>
                            <p className="text-2xl font-bold text-blue-600 mt-1">{stats.assignments}</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                            <div className="flex items-center gap-2">
                                <Star className="w-4 h-4 text-yellow-600" />
                                <span className="text-sm text-gray-600">Quizzes</span>
                            </div>
                            <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.quizzes}</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                            <div className="flex items-center gap-2">
                                <MessageCircle className="w-4 h-4 text-green-600" />
                                <span className="text-sm text-gray-600">Discussions</span>
                            </div>
                            <p className="text-2xl font-bold text-green-600 mt-1">{stats.discussions}</p>
                        </div>
                        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                            <div className="flex items-center gap-2">
                                <Target className="w-4 h-4 text-orange-600" />
                                <span className="text-sm text-gray-600">Active</span>
                            </div>
                            <p className="text-2xl font-bold text-orange-600 mt-1">{stats.active}</p>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
                    <div className="flex flex-col lg:flex-row gap-6">
                        {/* Search */}
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search assignments, quizzes, discussions..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                            />
                        </div>

                        {/* Topic Filter */}
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <select
                                value={selectedTopic}
                                onChange={(e) => setSelectedTopic(e.target.value)}
                                className="pl-10 pr-8 py-2.5 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer min-w-[200px] transition-all duration-200"
                            >
                                <option value="">All Topics</option>
                                {topics.map(topic => (
                                    <option value={topic._id} key={topic._id}>
                                        {topic.title}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Type Filters */}
                    <div className="mt-6 pt-6 border-t border-gray-100">
                        <div className="flex flex-wrap items-center gap-4">
                            <span className="text-sm font-medium text-gray-700">Content Type:</span>
                            {(Object.keys(typeFilter) as FeedType[]).map((type) => (
                                <label key={type} className="flex items-center gap-2 cursor-pointer select-none group">
                                    <input
                                        type="checkbox"
                                        checked={typeFilter[type]}
                                        onChange={() =>
                                            setTypeFilter((prev) => ({
                                                ...prev,
                                                [type]: !prev[type]
                                            }))
                                        }
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <div className={`p-1.5 rounded-lg ${iconMap[type].bg} ${iconMap[type].color} group-hover:scale-105 transition-transform`}>
                                        {iconMap[type].icon}
                                    </div>
                                    <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                                        {typeLabel[type]}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Feed Content */}
                {loading ? (
                    <div className="text-center py-16 text-gray-500">Loading feed…</div>
                ) : error ? (
                    <div className="text-center py-16 text-red-500">{error}</div>
                ) : Object.keys(grouped).length === 0 ? (
                    <div className="text-center py-16">
                        <div className="max-w-md mx-auto">
                            <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">No content found</h3>
                            <p className="text-gray-500">
                                {searchTerm
                                    ? `No results match your search for "${searchTerm}"`
                                    : "No content available with the selected filters"
                                }
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {Object.entries(grouped).map(([topicTitle, items]) => (
                            <div key={topicTitle} className="group">
                                {/* Topic Header */}
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full"></div>
                                    <div>
                                        <h2 className="text-xl font-semibold text-gray-900">
                                            {topicTitle !== "Uncategorized" ? topicTitle : (
                                                <span className="text-gray-500">Uncategorized</span>
                                            )}
                                        </h2>
                                        <p className="text-sm text-gray-500">
                                            {items.length} item{items.length !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                </div>

                                {/* Items */}
                                <div className="space-y-4">
                                    {(showAll[topicTitle] ? items : items.slice(0, 4)).map((item) => {
                                        const daysLeft = getDaysUntilDue(item.dueDate);
                                        const typeConfig = iconMap[item.type];

                                        return (
                                            <div
                                                key={item._id}
                                                className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group/card"
                                            >
                                                <div className="p-6">
                                                    {/* Header */}
                                                    <div className="flex items-start justify-between mb-4">
                                                        <div className="flex items-center gap-4 flex-1">
                                                            <div className={`p-3 rounded-xl ${typeConfig.bg} ${typeConfig.color} group-hover/card:scale-105 transition-transform duration-200`}>
                                                                {typeConfig.icon}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-3 mb-2">
                                                                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                                                                        {item.title}
                                                                    </h3>
                                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeConfig.bg} ${typeConfig.color}`}>
                                                                        {typeLabel[item.type]}
                                                                    </span>
                                                                    {item.status && (
                                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${statusConfig[item.status].bg} ${statusConfig[item.status].color}`}>
                                                                            {statusConfig[item.status].icon}
                                                                            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-4 text-sm text-gray-500">
                                                                    <div className="flex items-center gap-1">
                                                                        <Calendar className="w-3 h-3" />
                                                                        {formatDate(item.updatedAt || item.createdAt)}
                                                                    </div>
                                                                    <div className="flex items-center gap-1">
                                                                        <User className="w-3 h-3" />
                                                                        {item.postedBy?.username}
                                                                    </div>
                                                                    {item.points && (
                                                                        <div className="flex items-center gap-1">
                                                                            <Award className="w-3 h-3" />
                                                                            {item.points} pts
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {daysLeft !== null && (
                                                            <div className={`text-right ${daysLeft < 0 ? 'text-red-600' :
                                                                daysLeft <= 3 ? 'text-orange-600' :
                                                                    'text-gray-600'
                                                                }`}>
                                                                <div className="text-xs font-medium">
                                                                    {daysLeft < 0
                                                                        ? 'Overdue'
                                                                        : daysLeft === 0
                                                                            ? 'Due Today'
                                                                            : daysLeft === 1
                                                                                ? 'Due Tomorrow'
                                                                                : `${daysLeft} days left`
                                                                    }
                                                                </div>

                                                                <div className="text-xs text-gray-500">
                                                                    Due {formatDate(item.dueDate!)}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Content */}
                                                    {item.content && (
                                                        <div
                                                            className=" announcement-content text-gray-600 line-clamp-2 mb-4"
                                                            dangerouslySetInnerHTML={{ __html: item.content }}
                                                        />
                                                    )}


                                                    {/* Progress Bar */}
                                                    {item.progress !== undefined && (
                                                        <div className="mb-4">
                                                            <div className="flex items-center justify-between text-sm mb-1">
                                                                <span className="text-gray-600">Progress</span>
                                                                <span className="font-medium text-gray-900">{item.progress}%</span>
                                                            </div>
                                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                                <div
                                                                    className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-300"
                                                                    style={{ width: `${item.progress}%` }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Footer */}
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-4 text-sm text-gray-500">
                                                            {item.type === 'quiz' && item.questions && (
                                                                <span>{item.questions.length} questions</span>
                                                            )}
                                                            {item.type === 'groupAssignment' && item.groups && (
                                                                <span>{item.groups.length} groups</span>
                                                            )}
                                                            {item.documents && item.documents.length > 0 && (
                                                                <span className="flex items-center gap-1">
                                                                    <Download className="w-3 h-3" />
                                                                    {item.documents.length} files
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors group/btn">
                                                                <Bookmark className="w-4 h-4 text-gray-400 group-hover/btn:text-gray-600" />
                                                            </button>
                                                            <button
                                                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors group/btn"
                                                                onClick={() => router.push(getDetailUrl(item, courseInstanceId))}
                                                            >
                                                                <span>View</span>
                                                                <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Show More/Less Button */}
                                    {items.length > 4 && (
                                        <button
                                            onClick={() => setShowAll(prev => ({ ...prev, [topicTitle]: !prev[topicTitle] }))}
                                            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium transition-colors mx-auto mt-4"
                                        >
                                            <ChevronDown className={`w-4 h-4 transition-transform ${showAll[topicTitle] ? "rotate-180" : ""}`} />
                                            {showAll[topicTitle] ? "Show Less" : `Show ${items.length - 4} More`}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
