import { X, Sparkles, Shield, AlertTriangle, CheckCircle, FileText, Eye } from "lucide-react";
import { useState } from "react";

export default function PlagiarismModal({
    result,
    onClose,
}: {
    result: any;
    onClose: () => void;
}) {
    const [showDetails, setShowDetails] = useState(false);

    if (!result) return null;

    const getStatusConfig = (status: string) => {
        switch (status) {
            case "PLAGIARIZED":
                return {
                    icon: AlertTriangle,
                    color: "text-red-600",
                    bgColor: "bg-red-50",
                    borderColor: "border-red-200",
                    gradient: "from-red-500 to-pink-600"
                };
            case "ACCEPTED":
                return {
                    icon: CheckCircle,
                    color: "text-green-600",
                    bgColor: "bg-green-50",
                    borderColor: "border-green-200",
                    gradient: "from-green-500 to-emerald-600"
                };
            default:
                return {
                    icon: Shield,
                    color: "text-blue-600",
                    bgColor: "bg-blue-50",
                    borderColor: "border-blue-200",
                    gradient: "from-blue-500 to-indigo-600"
                };
        }
    };

    const statusConfig = getStatusConfig(result.status);
    const StatusIcon = statusConfig.icon;
    const similarityScore = Number(result.plagiarism);

    const getSimilarityColor = (score: number) => {
        if (score >= 80) return "text-red-600";
        if (score >= 50) return "text-orange-500";
        if (score >= 25) return "text-yellow-600";
        return "text-green-600";
    };

    const getMatchTypeConfig = (type: string) => {
        switch (type) {
            case "submission":
                return {
                    color: "text-blue-600",
                    bgColor: "bg-blue-100",
                    label: "Student Submission"
                };
            default:
                return {
                    color: "text-purple-600",
                    bgColor: "bg-purple-100",
                    label: "Reference Document"
                };
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xl p-4">
            <div className="bg-white max-w-4xl w-full rounded-3xl shadow-2xl relative border border-gray-100 max-h-[90vh] overflow-hidden">
                {/* Header with gradient */}
                <div className={`bg-gradient-to-r ${statusConfig.gradient} p-6 relative overflow-hidden`}>
                    {/* Background pattern */}
                    <div className="absolute inset-0 opacity-10">
                        <div className="absolute top-0 left-0 w-32 h-32 bg-white rounded-full -translate-x-16 -translate-y-16"></div>
                        <div className="absolute bottom-0 right-0 w-24 h-24 bg-white rounded-full translate-x-12 translate-y-12"></div>
                    </div>

                    <button
                        className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm rounded-full p-2 hover:bg-white/30 transition-all duration-200"
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <X className="w-6 h-6 text-white" />
                    </button>

                    <div className="flex items-center gap-4 mb-4">
                        <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
                            <Sparkles className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h2 className="font-bold text-white text-3xl">
                                Plagiarism Analysis
                            </h2>
                            <p className="text-white/80 text-lg">
                                Comprehensive similarity detection results
                            </p>
                        </div>
                    </div>
                </div>

                {/* Main content */}
                <div className="p-8 overflow-y-auto max-h-[calc(90vh-120px)]">
                    {/* Status and Similarity Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        {/* Status Card */}
                        <div className={`${statusConfig.bgColor} ${statusConfig.borderColor} border-2 rounded-2xl p-6`}>
                            <div className="flex items-center gap-3 mb-3">
                                <StatusIcon className={`w-8 h-8 ${statusConfig.color}`} />
                                <span className="font-semibold text-gray-700 text-lg">Status</span>
                            </div>
                            <div className={`${statusConfig.color} font-bold text-2xl`}>
                                {result.status}
                            </div>
                        </div>

                        {/* Similarity Card */}
                        <div className="bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-200 rounded-2xl p-6">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="bg-orange-100 rounded-full p-2">
                                    <FileText className="w-6 h-6 text-orange-600" />
                                </div>
                                <span className="font-semibold text-gray-700 text-lg">Similarity Score</span>
                            </div>
                            <div className={`${getSimilarityColor(similarityScore)} font-bold text-3xl`}>
                                {similarityScore.toFixed(2)}%
                            </div>
                            {/* Progress bar */}
                            <div className="mt-4 w-full bg-gray-200 rounded-full h-3">
                                <div
                                    className={`h-3 rounded-full transition-all duration-1000 ${similarityScore >= 80 ? 'bg-red-500' :
                                            similarityScore >= 50 ? 'bg-orange-500' :
                                                similarityScore >= 25 ? 'bg-yellow-500' : 'bg-green-500'
                                        }`}
                                    style={{ width: `${Math.min(similarityScore, 100)}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>

                    {/* Human-readable message */}
                    {result.message && (
                        <div className="bg-blue-50 border-l-4 border-blue-400 rounded-r-xl p-6 mb-8">
                            <div className="flex items-start gap-3">
                                <div className="bg-blue-100 rounded-full p-2 mt-1">
                                    <Eye className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-blue-900 mb-2">Analysis Summary</h3>
                                    <p className="text-blue-800 leading-relaxed">{result.message}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Top Matches */}
                    {result.matches && result.matches.length > 0 && (
                        <div className="mb-8">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-full p-2">
                                    <Shield className="w-6 h-6 text-white" />
                                </div>
                                <h3 className="font-bold text-gray-800 text-xl">
                                    Detected Matches ({result.matches.length})
                                </h3>
                            </div>

                            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                                {result.matches.slice(0, 5).map((match: any, idx: number) => {
                                    const matchConfig = getMatchTypeConfig(match.type);
                                    return (
                                        <div
                                            key={idx}
                                            className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-200"
                                        >
                                            {/* Match header */}
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <span className={`${matchConfig.bgColor} ${matchConfig.color} px-3 py-1 rounded-full text-sm font-semibold`}>
                                                        {matchConfig.label}
                                                    </span>
                                                    <span className="bg-gray-100 px-3 py-1 rounded-full text-sm font-mono text-gray-600">
                                                        ID: {match.source_id}
                                                    </span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-sm text-gray-500">Similarity</div>
                                                    <div className={`font-bold text-lg ${getSimilarityColor((match.similarity * 100))}`}>
                                                        {(match.similarity * 100).toFixed(2)}%
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Page and bbox info */}
                                            {(match.page !== undefined && match.page !== null) && (
                                                <div className="mb-2 text-sm text-gray-600 font-mono">
                                                    Page: {match.page} &nbsp;|&nbsp; 
                                                    BBox: {match.bbox ? `[${match.bbox.map((v: number) => v.toFixed(1)).join(", ")}]` : "N/A"}
                                                </div>
                                            )}

                                            {/* Matched text */}
                                            {(match.matched_text || match.source_text) && (
                                                <div className="space-y-3">
                                                    {match.matched_text && (
                                                        <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl p-4">
                                                            <div className="text-sm text-red-600 font-semibold mb-2">Matched Content (Your Submission):</div>
                                                            <blockquote className="text-gray-800 italic leading-relaxed border-l-4 border-red-300 pl-4">
                                                                "{match.matched_text}"
                                                            </blockquote>
                                                        </div>
                                                    )}
                                                    {match.source_text && (
                                                        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-4">
                                                            <div className="text-sm text-purple-600 font-semibold mb-2">Source Content (Reference/Submission):</div>
                                                            <blockquote className="text-gray-800 italic leading-relaxed border-l-4 border-purple-300 pl-4">
                                                                "{match.source_text}"
                                                            </blockquote>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Show in document button */}
                                            {(match.page !== undefined && match.page !== null && match.bbox) && (
                                                <button
                                                    className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
                                                    onClick={() => {
                                                        // Hook this to your PDF viewer to highlight the bbox on the page
                                                        alert(`Highlighting page ${match.page} at bbox ${match.bbox.map((v: number) => v.toFixed(1)).join(", ")}`);
                                                    }}
                                                >
                                                    Show in Document
                                                </button>
                                            )}

                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Raw details toggle */}
                    <div className="bg-gray-50 rounded-2xl p-6">
                        <button
                            onClick={() => setShowDetails(!showDetails)}
                            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors duration-200"
                        >
                            <span className="text-sm font-medium">
                                {showDetails ? 'Hide' : 'Show'} Technical Details
                            </span>
                            <div className={`transform transition-transform duration-200 ${showDetails ? 'rotate-180' : ''}`}>
                                ▼
                            </div>
                        </button>

                        {showDetails && (
                            <div className="mt-4 bg-gray-900 rounded-xl p-4 max-h-64 overflow-auto">
                                <pre className="text-green-400 text-xs font-mono whitespace-pre-wrap">
                                    {JSON.stringify(result, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Helper functions outside component
function getMatchTypeConfig(type: string) {
    switch (type) {
        case "submission":
            return {
                color: "text-blue-600",
                bgColor: "bg-blue-100",
                label: "Student Submission"
            };
        default:
            return {
                color: "text-purple-600",
                bgColor: "bg-purple-100",
                label: "Reference Document"
            };
    }
}

function getSimilarityColor(score: number) {
    if (score >= 80) return "text-red-600";
    if (score >= 50) return "text-orange-500";
    if (score >= 25) return "text-yellow-600";
    return "text-green-600";
}
