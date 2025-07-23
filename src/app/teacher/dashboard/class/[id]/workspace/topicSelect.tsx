"use client";
import React, { useEffect, useState } from "react";
import {
    FileText, Book, FileImage, Video, Link, User, Clock, Eye,
    Download, Maximize2, X, FileSpreadsheet, Presentation, File,
    ChevronDown, Users, Hash, Sparkles, MoreVertical
} from "lucide-react";

// --- Type Definitions ---
interface UserType { _id?: string; username?: string; email?: string; }
interface MaterialOrAssignment {
    _id: string;
    title: string;
    content: string;
    postedBy?: UserType;
    createdAt: string;
    updatedAt?: string;
    type?: "material" | "assignment";
    media?: string[];
    documents?: string[];
    youtubeLinks?: string[];
    visibleTo?: UserType[];
    links?: string[];
    // topic?: { _id: string, title: string }; // not needed in the card here
}
interface TopicGroup {
    topic: { _id: string | null; title: string };
    materials: MaterialOrAssignment[];
    assignments: MaterialOrAssignment[];
}

// --- Utilities ---
function getYoutubeEmbed(url: string): string {
    const id =
        url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)?.[1] ||
        url.match(/youtube\.com\/watch\?.*v=([^&\n?#]+)/)?.[1];
    return id ? `https://www.youtube.com/embed/${id}` : url;
}
function getFileUrl(file: string) {
    if (file.startsWith("http")) return file;
    if (file.startsWith("/uploads/")) return `http://localhost:5000${file}`;
    return `http://localhost:5000/uploads/${file.replace(/^uploads\//, "")}`;
}
function getFileIcon(filename: string) {
    const ext = filename.split('.').pop()?.toLowerCase() || "";
    switch (ext) {
        case 'pdf': return <FileText className="w-5 h-5 text-red-500" />;
        case 'doc':
        case 'docx': return <FileText className="w-5 h-5 text-blue-600" />;
        case 'xls':
        case 'xlsx': return <FileSpreadsheet className="w-5 h-5 text-green-600" />;
        case 'ppt':
        case 'pptx': return <Presentation className="w-5 h-5 text-orange-500" />;
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif':
        case 'webp': return <FileImage className="w-5 h-5 text-purple-500" />;
        case 'mp4':
        case 'avi':
        case 'mov':
        case 'wmv': return <Video className="w-5 h-5 text-pink-500" />;
        default: return <File className="w-5 h-5 text-gray-500" />;
    }
}
function getFileTypeLabel(filename: string) {
    const ext = filename.split('.').pop()?.toLowerCase() || "";
    const typeMap: { [key: string]: string } = {
        'pdf': 'PDF Document',
        'doc': 'Word Document', 'docx': 'Word Document',
        'xls': 'Excel Spreadsheet', 'xlsx': 'Excel Spreadsheet',
        'ppt': 'PowerPoint Presentation', 'pptx': 'PowerPoint Presentation',
        'jpg': 'Image', 'jpeg': 'Image', 'png': 'Image', 'gif': 'Image', 'webp': 'Image',
        'mp4': 'Video', 'avi': 'Video', 'mov': 'Video', 'wmv': 'Video'
    };
    return typeMap[ext] || 'File';
}
function getFileSize(filename: string) {
    const mockSizes = ['1.2 MB', '856 KB', '3.4 MB', '524 KB', '2.1 MB'];
    return mockSizes[Math.floor(Math.random() * mockSizes.length)];
}
function formatTimeAgo(dateString: string) {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
}

// --- Modal Component ---
function Modal({ children, onClose, isFull, onToggleFull }: {
    children: React.ReactNode, onClose: () => void, isFull: boolean, onToggleFull: () => void
}) {
    return (
        <div className={`fixed inset-0 z-50 bg-black/60 flex items-center justify-center ${isFull ? "p-0" : "p-4"} backdrop-blur-md transition-all duration-300`}>
            <div className={`bg-white rounded-2xl shadow-2xl w-full ${isFull ? "h-full rounded-none" : "max-w-5xl max-h-[90vh]"} relative flex flex-col overflow-hidden`}>
                <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
                    <h3 className="font-bold text-xl text-gray-800 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-blue-600" />
                        Document Preview
                    </h3>
                    <div className="flex items-center gap-2">
                        <button
                            className="p-2 hover:bg-white/80 rounded-xl"
                            onClick={onToggleFull}
                            title={isFull ? "Exit Fullscreen" : "Fullscreen"}
                        >
                            <Maximize2 className="w-5 h-5 text-gray-600" />
                        </button>
                        <button
                            className="p-2 hover:bg-red-100 rounded-xl"
                            onClick={onClose}
                            title="Close"
                        >
                            <X className="w-5 h-5 text-red-500" />
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-auto">{children}</div>
            </div>
        </div>
    );
}

// --- Loading Component ---
function LoadingSkeleton() {
    return (
        <div className="space-y-6 animate-pulse">
            {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-2xl border shadow-sm p-6">
                    <div className="h-6 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg mb-4"></div>
                    <div className="space-y-3">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                </div>
            ))}
        </div>
    );
}

// --- Enhanced Card Component ---
function ContentCard({
    item, isExpanded, onToggle, onPreview, allStudents,
    onEdit, onDelete
}: {
    item: MaterialOrAssignment;
    isExpanded: boolean;
    onToggle: () => void;
    onPreview: (content: React.ReactNode) => void;
    allStudents: UserType[];
    onEdit: () => void;
    onDelete: () => void;
}) {
    const [menuOpen, setMenuOpen] = useState(false);
    const typeConfig = {
        assignment: {
            color: 'from-blue-500 to-blue-600',
            bg: 'bg-blue-50',
            border: 'border-blue-200',
            icon: <FileText className="w-4 h-4" />,
            label: 'Assignment'
        },
        material: {
            color: 'from-emerald-500 to-emerald-600',
            bg: 'bg-emerald-50',
            border: 'border-emerald-200',
            icon: <Book className="w-4 h-4" />,
            label: 'Material'
        }
    };
    const config = typeConfig[item.type || "material"];
    useEffect(() => {
        if (!menuOpen) return;
        function handle(e: MouseEvent) {
            setMenuOpen(false);
        }
        document.addEventListener("click", handle);
        return () => document.removeEventListener("click", handle);
    }, [menuOpen]);
    return (
        <div className={`group transition-all duration-300 hover:shadow-lg ${isExpanded ? 'shadow-lg' : 'shadow-sm'}`}>
            <div
                className={`p-6 cursor-pointer bg-white rounded-2xl border-2 transition-all duration-300 ${isExpanded
                    ? `${config.border} ${config.bg} transform scale-[1.02]`
                    : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                onClick={onToggle}
            >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg text-gray-900 mb-2 group-hover:text-gray-700 transition-colors">
                            {item.title}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                                    <User className="w-4 h-4 text-white" />
                                </div>
                                <span className="font-medium">
                                    {item.postedBy?.username || item.postedBy?.email || "Unknown"}
                                </span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                <span>{formatTimeAgo(item.createdAt)}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Student count & tooltip */}
                        {Array.isArray(item.visibleTo) && item.visibleTo.length > 0 ? (
                            <div className="relative group">
                                <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 rounded-full text-xs text-blue-700 font-semibold cursor-pointer">
                                    <Users className="w-4 h-4" />
                                    <span>{item.visibleTo.length}</span>
                                </div>
                                {/* Tooltip with specific allowed students */}
                                <div className="absolute left-0 z-20 mt-2 px-4 py-2 bg-white rounded-lg shadow-lg text-sm text-gray-700 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity duration-200 max-h-48 overflow-y-auto">
                                    {item.visibleTo.map((u: any) => (
                                        <div key={u._id || u.email}>{u.username || u.email}</div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="relative group">
                                <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 rounded-full text-xs text-blue-700 font-semibold cursor-pointer">
                                    <Users className="w-4 h-4" />
                                    <span>All</span>
                                </div>
                                {/* Tooltip with ALL students */}
                                <div className="absolute left-0 z-20 mt-2 px-4 py-2 bg-white rounded-lg shadow-lg text-sm text-gray-700 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity duration-200 max-h-48 overflow-y-auto">
                                    {allStudents.map((u: any) => (
                                        <div key={u._id || u.email}>{u.username || u.email}</div>
                                    ))}
                                </div>
                            </div>
                        )}


                        {/* Type badge */}
                        <div className={`px-4 py-2 rounded-full bg-gradient-to-r ${config.color} text-white font-semibold text-sm flex items-center gap-2 shadow-md`}>
                            {config.icon}
                            {config.label}
                        </div>
                        {/* Expand/collapse chevron */}
                        <div className="flex flex-col items-center justify-center cursor-pointer ">
                            <div className={`p-2 rounded-full transition-all duration-200 ${isExpanded ? 'bg-gray-200 rotate-180' : 'bg-gray-100 group-hover:bg-gray-200'}`}>
                                <ChevronDown className="w-5 h-5 text-gray-600" />
                            </div>
                            <div className="relative mt-2">
                                <button
                                    onClick={e => {
                                        e.stopPropagation();
                                        setMenuOpen(open => !open);
                                    }}
                                    className="p-2 rounded-full hover:bg-gray-200"
                                    title="More"
                                >
                                    <MoreVertical className="w-5 h-5 text-gray-600" />
                                </button>
                                {menuOpen && (
                                    <div
                                        onClick={e => e.stopPropagation()}
                                        className="absolute right-0 mt-2 z-30 bg-white rounded shadow-lg border flex flex-col py-1 w-32"
                                    >
                                        <button
                                            className="w-full text-left px-4 py-2 hover:bg-blue-50 text-blue-700"
                                            onClick={() => { setMenuOpen(false); onEdit(); }}
                                        >Edit</button>
                                        <button
                                            className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600"
                                            onClick={() => { setMenuOpen(false); onDelete(); }}
                                        >Delete</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                </div>
                {/* Content Attachments Preview */}
                <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                    {item.documents && item.documents.length > 0 && (
                        <div className="flex items-center gap-1 px-3 py-1 bg-red-50 rounded-full">
                            <FileText className="w-4 h-4 text-red-500" />
                            <span className="font-medium">{item.documents.length} docs</span>
                        </div>
                    )}
                    {item.media && item.media.length > 0 && (
                        <div className="flex items-center gap-1 px-3 py-1 bg-purple-50 rounded-full">
                            <FileImage className="w-4 h-4 text-purple-500" />
                            <span className="font-medium">{item.media.length} images</span>
                        </div>
                    )}
                    {item.youtubeLinks && item.youtubeLinks.length > 0 && (
                        <div className="flex items-center gap-1 px-3 py-1 bg-red-50 rounded-full">
                            <Video className="w-4 h-4 text-red-600" />
                            <span className="font-medium">{item.youtubeLinks.length} videos</span>
                        </div>
                    )}
                    {item.links && item.links.length > 0 && (
                        <div className="flex items-center gap-1 px-3 py-1 bg-green-50 rounded-full">
                            <Link className="w-4 h-4 text-green-600" />
                            <span className="font-medium">{item.links.length} links</span>
                        </div>
                    )}
                </div>
                {/* Expanded Content */}
                <div className={`transition-all duration-500 overflow-hidden ${isExpanded ? 'max-h-none opacity-100 mt-6' : 'max-h-0 opacity-0'
                    }`}>
                    {isExpanded && (
                        <div className="space-y-6">
                            {/* Content */}
                            <div className="announcement-content prose max-w-none bg-white p-6 rounded-xl border border-gray-100"
                                dangerouslySetInnerHTML={{ __html: item.content }} />

                            {/* Documents */}
                            {item.documents && item.documents.length > 0 && (
                                <div className="bg-gradient-to-br from-red-50 to-orange-50 p-6 rounded-xl border border-red-100">
                                    <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-3 text-lg">
                                        <div className="p-2 bg-red-100 rounded-lg">
                                            <FileText className="w-6 h-6 text-red-600" />
                                        </div>
                                        Documents ({item.documents.length})
                                    </h4>
                                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                        {item.documents.map((doc, i) => {
                                            const docUrl = getFileUrl(doc);
                                            const filename = doc.split("/").pop() || doc;
                                            const ext = doc.split('.').pop()?.toLowerCase() || "";
                                            const isOffice = ["doc", "docx", "ppt", "pptx", "xls", "xlsx"].includes(ext);
                                            const isPdf = ext === "pdf";
                                            return (
                                                <div key={i} className="bg-white border-2 border-gray-100 rounded-xl p-4 hover:border-red-200 hover:shadow-md transition-all duration-200 group">
                                                    <div className="flex items-start gap-3">
                                                        <div className="flex-shrink-0 p-2 bg-gray-50 rounded-lg group-hover:bg-red-50 transition-colors">
                                                            {getFileIcon(filename)}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-semibold text-gray-900 text-sm truncate mb-1" title={filename}>
                                                                {filename}
                                                            </div>
                                                            <div className="text-xs text-gray-500 mb-3">
                                                                {getFileTypeLabel(filename)} • {getFileSize(filename)}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={e => {
                                                                        e.stopPropagation();
                                                                        onPreview(
                                                                            <div className="p-6">
                                                                                {isOffice ? (
                                                                                    <iframe
                                                                                        src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(docUrl)}`}
                                                                                        className="w-full h-[70vh] border-0 rounded-lg"
                                                                                        title={filename}
                                                                                    />
                                                                                ) : isPdf ? (
                                                                                    <iframe
                                                                                        src={docUrl}
                                                                                        className="w-full h-[70vh] border-0 rounded-lg"
                                                                                        title={filename}
                                                                                    />
                                                                                ) : (
                                                                                    <div className="text-center py-12">
                                                                                        <File className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                                                                        <p className="text-gray-500">Preview not available for this file type</p>
                                                                                        <a
                                                                                            href={docUrl}
                                                                                            target="_blank"
                                                                                            rel="noopener noreferrer"
                                                                                            className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                                                                        >
                                                                                            <Download className="w-4 h-4" />
                                                                                            Download File
                                                                                        </a>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    }}
                                                                >
                                                                    <Eye className="w-3 h-3" />
                                                                    Preview
                                                                </button>
                                                                <a
                                                                    href={docUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition-all duration-200 hover:scale-105"
                                                                    onClick={e => e.stopPropagation()}
                                                                >
                                                                    <Download className="w-3 h-3" />
                                                                    Download
                                                                </a>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Images */}
                            {item.media && item.media.length > 0 && (
                                <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl border border-purple-100">
                                    <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-3 text-lg">
                                        <div className="p-2 bg-purple-100 rounded-lg">
                                            <FileImage className="w-6 h-6 text-purple-600" />
                                        </div>
                                        Images ({item.media.length})
                                    </h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                        {item.media.map((img, i) => (
                                            <div
                                                key={i}
                                                className="group relative cursor-pointer transform transition-all duration-300 hover:scale-105"
                                                onClick={e => {
                                                    e.stopPropagation();
                                                    onPreview(
                                                        <div className="flex flex-col items-center p-6 bg-black/80 min-h-[50vh]">
                                                            <img
                                                                src={getFileUrl(img)}
                                                                className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-lg border mb-4"
                                                                alt={`Preview ${i + 1}`}
                                                                style={{ background: "#fff" }}
                                                            />
                                                            <a
                                                                href={getFileUrl(img)}
                                                                download
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                                                                style={{ marginTop: "1rem" }}
                                                                onClick={e => e.stopPropagation()}
                                                            >
                                                                <Download className="w-5 h-5" />
                                                                Download Image
                                                            </a>
                                                        </div>
                                                    );
                                                }}
                                            >
                                                <img
                                                    src={getFileUrl(img)}
                                                    alt={`Material image ${i + 1}`}
                                                    className="w-full h-32 object-cover rounded-xl border-2 border-gray-100 group-hover:border-purple-200 shadow-sm group-hover:shadow-md transition-all duration-300"
                                                />
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-all duration-300 rounded-xl backdrop-blur-sm">
                                                    <div className="bg-white/90 p-3 rounded-full shadow-lg">
                                                        <Eye className="w-6 h-6 text-gray-700" />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* YouTube Videos */}
                            {item.youtubeLinks && item.youtubeLinks.length > 0 && (
                                <div className="bg-gradient-to-br from-red-50 to-pink-50 p-6 rounded-xl border border-red-100">
                                    <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-3 text-lg">
                                        <div className="p-2 bg-red-100 rounded-lg">
                                            <Video className="w-6 h-6 text-red-600" />
                                        </div>
                                        Videos ({item.youtubeLinks.length})
                                    </h4>
                                    <div className="grid gap-6 sm:grid-cols-2">
                                        {item.youtubeLinks.map((url, i) => (
                                            <div
                                                key={i}
                                                className="rounded-xl overflow-hidden border-2 border-gray-100 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer"
                                                onClick={e => {
                                                    e.stopPropagation();
                                                    onPreview(
                                                        <div className="w-full flex items-center justify-center bg-black">
                                                            <iframe
                                                                src={getYoutubeEmbed(url)}
                                                                title={`YouTube Video ${i + 1}`}
                                                                className="w-[80vw] max-w-3xl h-[45vw] max-h-[70vh] bg-black rounded-xl border"
                                                                allowFullScreen
                                                            />
                                                        </div>
                                                    );
                                                }}
                                            >
                                                <iframe
                                                    src={getYoutubeEmbed(url)}
                                                    title={`YouTube Video ${i + 1}`}
                                                    className="w-full h-48 sm:h-56"
                                                    allowFullScreen
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Links */}
                            {item.links && item.links.length > 0 && (
                                <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border border-green-100">
                                    <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-3 text-lg">
                                        <div className="p-2 bg-green-100 rounded-lg">
                                            <Link className="w-6 h-6 text-green-600" />
                                        </div>
                                        Links ({item.links.length})
                                    </h4>
                                    <div className="space-y-3">
                                        {item.links.map((url, i) => (
                                            <a
                                                key={i}
                                                href={url}
                                                className="flex items-center gap-3 p-4 bg-white hover:bg-green-50 border-2 border-gray-100 hover:border-green-200 rounded-xl transition-all duration-200 text-green-700 hover:text-green-800 group hover:scale-105 shadow-sm hover:shadow-md"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={e => {
                                                    e.stopPropagation();
                                                    onPreview(
                                                        <div className="p-10 bg-white max-w-xl mx-auto rounded-lg text-center space-y-6">
                                                            <div className="flex justify-center">
                                                                <Link className="w-12 h-12 text-green-600" />
                                                            </div>
                                                            <div className="text-xl font-semibold mb-2">{url}</div>
                                                            <a
                                                                href={url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                                                            >
                                                                <ExternalLinkIcon className="w-4 h-4" />
                                                                Open Link
                                                            </a>
                                                        </div>
                                                    );
                                                }}
                                            >
                                                <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                                                    <Link className="w-4 h-4" />
                                                </div>
                                                <span className="text-sm font-medium truncate flex-1">{url}</span>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
function ExternalLinkIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" {...props}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 7l-1.414-1.414A2 2 0 0014.172 5H5.828a2 2 0 00-2 2v9.344a2 2 0 002 2h9.344a2 2 0 002-2v-8.172a2 2 0 00-.586-1.414zM17 7v6m0-6h-6" />
        </svg>
    );
}

// --- Main Component ---
export default function UnifiedFeed({
    courseInstanceId,
    token
}: {
    courseInstanceId: string;
    token: string;
}) {
    const [feedData, setFeedData] = useState<TopicGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [modalContent, setModalContent] = useState<React.ReactNode | null>(null);
    const [modalFull, setModalFull] = useState(false);
    const [allStudents, setAllStudents] = useState<UserType[]>([]);
    const [selectedTopic, setSelectedTopic] = useState<string>("all");
    const [deleteTarget, setDeleteTarget] = useState<MaterialOrAssignment | null>(null);
    const [editTarget, setEditTarget] = useState<MaterialOrAssignment | null>(null);
    const [deleteTopicTarget, setDeleteTopicTarget] = useState<{ _id: string | null, title: string } | null>(null);
    const [editTopicTarget, setEditTopicTarget] = useState<{ _id: string | null, title: string } | null>(null);
    const [topicMenuOpen, setTopicMenuOpen] = useState<string | null>(null);
    const [loadingDelete, setLoadingDelete] = useState(false);

    // Fetch students
    useEffect(() => {
        async function fetchStudents() {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/course-api/course-instance/${courseInstanceId}/students`);
            setAllStudents(await res.json());
        }
        fetchStudents();
    }, [courseInstanceId]);

    // Fetch feed data
    const fetchFeed = async () => {
        setLoading(true);
        try {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_BACKEND_URL}/Coursefeeds/${courseInstanceId}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            const data = await res.json();
            setFeedData(data);
        } catch (err) {
            setFeedData([]);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchFeed();
    }, [courseInstanceId, token]);

    // Topic dropdown options
    const topicOptions = [
        { _id: "all", title: "All Topics" },
        ...feedData
            .map(g => {
                if (
                    g.topic._id === null ||
                    g.topic.title.toLowerCase().includes("no topic") ||
                    g.topic.title.toLowerCase().includes("uncategorized")
                ) {
                    return { _id: "no-topic", title: "No Topic" };
                }
                return { _id: String(g.topic._id), title: g.topic.title };
            })
            .filter((t, i, arr) => arr.findIndex(x => x._id === t._id) === i)
    ];

    // Topic filtering
    let groupsToShow = feedData;
    if (selectedTopic === "no-topic") {
        groupsToShow = feedData.filter(g =>
            g.topic._id === null ||
            g.topic.title.toLowerCase().includes("no topic") ||
            g.topic.title.toLowerCase().includes("uncategorized")
        );
    } else if (selectedTopic !== "all") {
        groupsToShow = feedData.filter(g => String(g.topic._id) === selectedTopic);
    }
    if (selectedTopic === "all") {
        groupsToShow = [
            ...groupsToShow.filter(g =>
                g.topic._id === null ||
                g.topic.title.toLowerCase().includes("no topic") ||
                g.topic.title.toLowerCase().includes("uncategorized")
            ),
            ...groupsToShow.filter(g =>
                g.topic._id !== null &&
                !g.topic.title.toLowerCase().includes("no topic") &&
                !g.topic.title.toLowerCase().includes("uncategorized")
            ),
        ];
    }

    function getSortedItems(
        materials: MaterialOrAssignment[],
        assignments: MaterialOrAssignment[]
    ) {
        const all = [
            ...materials.map((m) => ({ ...m, type: "material" as const })),
            ...assignments.map((a) => ({ ...a, type: "assignment" as const }))
        ];
        return all.sort(
            (a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }

    // --- Delete Handlers ---
    async function handleDeleteItem() {
        if (!deleteTarget) return;
        setLoadingDelete(true);
        let url = "";
        if (deleteTarget.type === "material") {
            url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/materials/${deleteTarget._id}`;
        } else if (deleteTarget.type === "assignment") {
            url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/assignments/${deleteTarget._id}`;
        }
        if (url) {
            await fetch(url, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
        }
        setDeleteTarget(null);
        setLoadingDelete(false);
        fetchFeed();
    }

    async function handleDeleteTopic() {
        if (!deleteTopicTarget?._id) return;
        setLoadingDelete(true);
        await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/topics/${deleteTopicTarget._id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` }
        });
        setDeleteTopicTarget(null);
        setLoadingDelete(false);
        fetchFeed();
    }

    if (loading) return <LoadingSkeleton />;

    if (!feedData.length)
        return (
            <div className="text-center py-16">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Book className="w-12 h-12 text-gray-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-600 mb-2">No Content Yet</h3>
                <p className="text-gray-500">No assignments or materials have been posted yet.</p>
            </div>
        );

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            {/* Topic Filter Dropdown */}
            <div className="mb-8">
                <label className="block mb-1 font-semibold text-gray-700">Filter by Topic:</label>
                <select
                    className="border rounded px-3 py-2 w-full max-w-xs"
                    value={selectedTopic || ""}
                    onChange={e => setSelectedTopic(e.target.value)}
                >
                    {topicOptions.map(t => (
                        <option key={t._id} value={t._id}>{t.title}</option>
                    ))}
                </select>
            </div>

            {/* Feed Groups */}
            {groupsToShow.map((group) => {
                const items = getSortedItems(group.materials, group.assignments);
                if (items.length === 0) return null;

                const isNoTopic =
                    group.topic._id === null ||
                    group.topic.title.toLowerCase().includes("no topic") ||
                    group.topic.title.toLowerCase().includes("uncategorized");

                const topicTitle = isNoTopic ? "No Topic" : group.topic.title;
                const topicKey = group.topic._id ? String(group.topic._id) : "no-topic";

                return (
                    <div key={topicKey} className="space-y-6">
                        {/* Only show header if NOT "No Topic" */}
                        {!isNoTopic && (
                            <div className="relative bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-2xl p-6 text-white shadow-lg flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                                        <Hash className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold mb-1">{topicTitle}</h2>
                                        <p className="text-white/80 flex items-center gap-2">
                                            <Users className="w-4 h-4" />
                                            {items.length} {items.length === 1 ? "item" : "items"}
                                        </p>
                                    </div>
                                </div>
                                {/* Topic Three-dots Menu */}
                                <div className="relative">
                                    <button
                                        onClick={e => {
                                            e.stopPropagation();
                                            setTopicMenuOpen(topicKey === topicMenuOpen ? null : topicKey);
                                        }}
                                        className="p-2 rounded-full hover:bg-white/20"
                                        title="Topic Actions"
                                    >
                                        <MoreVertical className="w-6 h-6" />
                                    </button>
                                    {topicMenuOpen === topicKey && (
                                        <div
                                            className="absolute right-0 mt-2 z-40 bg-white text-gray-800 rounded shadow-lg border flex flex-col py-1 w-36"
                                            onClick={e => e.stopPropagation()}
                                        >
                                            <button
                                                className="w-full text-left px-4 py-2 hover:bg-blue-50"
                                                onClick={() => {
                                                    setEditTopicTarget(group.topic);
                                                    setTopicMenuOpen(null);
                                                }}
                                            >Edit Topic</button>
                                            <button
                                                className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600"
                                                onClick={() => {
                                                    setDeleteTopicTarget(group.topic);
                                                    setTopicMenuOpen(null);
                                                }}
                                                disabled={isNoTopic} // Disable for 'No Topic'
                                            >Delete Topic</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        {/* Items */}
                        <div className="space-y-4">
                            {items.map((item) => (
                                <ContentCard
                                    key={item._id}
                                    item={item}
                                    isExpanded={expanded === item._id}
                                    onToggle={() => setExpanded(expanded === item._id ? null : item._id)}
                                    onPreview={(node) => {
                                        setModalFull(false);
                                        setModalContent(node);
                                    }}
                                    allStudents={allStudents}
                                    onEdit={() => setEditTarget(item)}
                                    onDelete={() => setDeleteTarget(item)}
                                />
                            ))}
                        </div>
                    </div>
                );
            })}

            {modalContent && (
                <Modal
                    onClose={() => setModalContent(null)}
                    isFull={modalFull}
                    onToggleFull={() => setModalFull(f => !f)}
                >
                    {modalContent}
                </Modal>
            )}

            {/* Delete confirmation modal for items */}
            {deleteTarget && (
                <Modal onClose={() => setDeleteTarget(null)} isFull={false} onToggleFull={() => { }}>
                    <div className="p-8 text-center space-y-6">
                        <X className="w-10 h-10 mx-auto text-red-500" />
                        <div className="text-xl font-bold">Are you sure you want to delete?</div>
                        <div className="text-gray-500">"{deleteTarget.title}" will be permanently deleted.</div>
                        <div className="flex justify-center gap-4 mt-6">
                            <button
                                className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
                                onClick={() => setDeleteTarget(null)}
                                disabled={loadingDelete}
                            >
                                Cancel
                            </button>
                            <button
                                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
                                onClick={handleDeleteItem}
                                disabled={loadingDelete}
                            >
                                {loadingDelete ? "Deleting..." : "Delete"}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Delete confirmation modal for topics */}
            {deleteTopicTarget && (
                <Modal onClose={() => setDeleteTopicTarget(null)} isFull={false} onToggleFull={() => { }}>
                    <div className="p-8 text-center space-y-6">
                        <X className="w-10 h-10 mx-auto text-red-500" />
                        <div className="text-xl font-bold">Are you sure you want to delete this topic?</div>
                        <div className="text-gray-500">
                            "{deleteTopicTarget.title}" will be permanently deleted along with all its materials and assignments.
                        </div>
                        <div className="flex justify-center gap-4 mt-6">
                            <button
                                className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
                                onClick={() => setDeleteTopicTarget(null)}
                                disabled={loadingDelete}
                            >
                                Cancel
                            </button>
                            <button
                                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
                                onClick={handleDeleteTopic}
                                disabled={loadingDelete || deleteTopicTarget._id === null}
                            >
                                {loadingDelete ? "Deleting..." : "Delete Topic"}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Edit modals placeholder */}
            {editTarget && (
                <Modal onClose={() => setEditTarget(null)} isFull={false} onToggleFull={() => { }}>
                    <div className="p-10">
                        <h3 className="text-xl font-bold mb-4">Edit: {editTarget.title}</h3>
                        <div>Edit modal goes here.</div>
                        <button className="mt-8 px-4 py-2 rounded bg-blue-600 text-white"
                            onClick={() => setEditTarget(null)}
                        >Close</button>
                    </div>
                </Modal>
            )}

            {editTopicTarget && (
                <Modal onClose={() => setEditTopicTarget(null)} isFull={false} onToggleFull={() => { }}>
                    <div className="p-10">
                        <h3 className="text-xl font-bold mb-4">Edit Topic: {editTopicTarget.title}</h3>
                        <div>Edit topic modal goes here.</div>
                        <button className="mt-8 px-4 py-2 rounded bg-blue-600 text-white"
                            onClick={() => setEditTopicTarget(null)}
                        >Close</button>
                    </div>
                </Modal>
            )}

        </div>
    );
}
