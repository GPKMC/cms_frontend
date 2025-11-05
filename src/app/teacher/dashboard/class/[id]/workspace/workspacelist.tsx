"use client";
import { useEffect, useState } from "react";
import {
  FileText,
  FileImage,
  Video,
  Link,
  User,
  Clock,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  Maximize2,
  X,
  FileSpreadsheet,
  Presentation,
  File
} from "lucide-react";

// --- Types ---
interface Material {
  _id: string;
  title: string;
  content: string;
  postedBy?: { username?: string; email?: string };
  createdAt: string;
  media?: string[];         // Images/Media array
  documents?: string[];     // Document files array
  youtubeLinks?: string[];
  links?: string[];
}

function getYoutubeEmbed(url: string): string {
  const id =
    url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)?.[1] ||
    url.match(/youtube\.com\/watch\?.*v=([^&\n?#]+)/)?.[1];
  return id ? `https://www.youtube.com/embed/${id}` : url;
}

function getFileUrl(file: string) {
  if (file.startsWith("http")) return file;
  if (file.startsWith("/uploads/")) return `http://NEXT_PUBLIC_BACKEND_URL${file}`;
  return `http://NEXT_PUBLIC_BACKEND_URL/uploads/${file.replace(/^uploads\//, "")}`;
}

// Get appropriate icon for file type
function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || "";

  switch (ext) {
    case 'pdf':
      return <FileText className="w-5 h-5 text-red-500" />;
    case 'doc':
    case 'docx':
      return <FileText className="w-5 h-5 text-blue-600" />;
    case 'xls':
    case 'xlsx':
      return <FileSpreadsheet className="w-5 h-5 text-green-600" />;
    case 'ppt':
    case 'pptx':
      return <Presentation className="w-5 h-5 text-orange-500" />;
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
      return <FileImage className="w-5 h-5 text-purple-500" />;
    case 'mp4':
    case 'avi':
    case 'mov':
    case 'wmv':
      return <Video className="w-5 h-5 text-pink-500" />;
    default:
      return <File className="w-5 h-5 text-gray-500" />;
  }
}

// Get file type label
function getFileTypeLabel(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || "";

  const typeMap: { [key: string]: string } = {
    'pdf': 'PDF Document',
    'doc': 'Word Document',
    'docx': 'Word Document',
    'xls': 'Excel Spreadsheet',
    'xlsx': 'Excel Spreadsheet',
    'ppt': 'PowerPoint Presentation',
    'pptx': 'PowerPoint Presentation',
    'jpg': 'Image',
    'jpeg': 'Image',
    'png': 'Image',
    'gif': 'Image',
    'webp': 'Image',
    'mp4': 'Video',
    'avi': 'Video',
    'mov': 'Video',
    'wmv': 'Video'
  };

  return typeMap[ext] || 'File';
}

// Get file size (mock function - you'd get this from your backend)
function getFileSize(filename: string) {
  // This is a mock - in real implementation, you'd get this from your API
  const mockSizes = ['1.2 MB', '856 KB', '3.4 MB', '524 KB', '2.1 MB'];
  return mockSizes[Math.floor(Math.random() * mockSizes.length)];
}

// Enhanced Modal component
function Modal({ children, onClose, isFull, onToggleFull }: {
  children: React.ReactNode,
  onClose: () => void,
  isFull: boolean,
  onToggleFull: () => void
}) {
  return (
    <div className={`fixed inset-0 z-50 bg-black/50 flex items-center justify-center ${isFull ? "p-0" : "p-4"} backdrop-blur-sm`}>
      <div className={`bg-white rounded-xl shadow-2xl w-full ${isFull ? "h-full rounded-none" : "max-w-4xl max-h-[90vh]"} relative flex flex-col overflow-hidden`}>
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <h3 className="font-semibold text-gray-800">Document Preview</h3>
          <div className="flex items-center gap-2">
            <button
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              onClick={onToggleFull}
              title={isFull ? "Exit Fullscreen" : "Fullscreen"}
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              onClick={onClose}
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}

export default function MaterialList({ courseInstanceId }: { courseInstanceId: string }) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalContent, setModalContent] = useState<React.ReactNode | null>(null);
  const [modalFull, setModalFull] = useState(false);

  useEffect(() => {
    const fetchMaterials = async () => {
      setLoading(true);
      try {
        const token =
          localStorage.getItem("token_teacher") ||
          localStorage.getItem("token_student") ||
          sessionStorage.getItem("token_teacher") ||
          sessionStorage.getItem("token_student") ||
          "";

        const res = await fetch(
          `{NEXT_PUBLIC_BACKEND_URL}/course-materials/course/${courseInstanceId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await res.json();
        if (data.materials) {
          setMaterials(data.materials);
        } else {
          setMaterials([]);
        }
      } catch (err) {
        setMaterials([]);
      }
      setLoading(false);
    };

    fetchMaterials();
  }, [courseInstanceId]);


  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading materials...</span>
      </div>
    );
  }

  if (materials.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 text-lg">No materials posted yet.</p>
      </div>
    );
  }

  return (
    <div className="my-6 space-y-4">
      {materials.map((mat) => (
        <div key={mat._id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
          {/* Material header */}
          <div
            className={`p-6 cursor-pointer transition-all ${expandedId === mat._id
                ? "bg-blue-50 border-b border-blue-100"
                : "hover:bg-gray-50"
              }`}
            onClick={() => setExpandedId(expandedId === mat._id ? null : mat._id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{mat.title}</h3>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    <span>{mat.postedBy?.username || mat.postedBy?.email || "Unknown"}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{new Date(mat.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Content indicators */}
                <div className="flex items-center gap-2">
                  {mat.documents && mat.documents.length > 0 && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                      <FileText className="w-3 h-3" />
                      <span>{mat.documents.length}</span>
                    </div>
                  )}
                  {mat.media && mat.media.length > 0 && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                      <FileImage className="w-3 h-3" />
                      <span>{mat.media.length}</span>
                    </div>
                  )}
                  {mat.youtubeLinks && mat.youtubeLinks.length > 0 && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
                      <Video className="w-3 h-3" />
                      <span>{mat.youtubeLinks.length}</span>
                    </div>
                  )}
                  {mat.links && mat.links.length > 0 && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                      <Link className="w-3 h-3" />
                      <span>{mat.links.length}</span>
                    </div>
                  )}
                </div>
                <div className="text-gray-400">
                  {expandedId === mat._id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </div>
            </div>
          </div>

          {/* Expanded content */}
          {expandedId === mat._id && (
            <div className="p-6 bg-white border-t border-gray-100">
              <div className="announcement-content prose max-w-none mb-6" dangerouslySetInnerHTML={{ __html: mat.content }} />

              {/* Enhanced Documents Section */}
              {mat.documents && mat.documents.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    Documents ({mat.documents.length})
                  </h4>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {mat.documents.map((doc, i) => {
                      const docUrl = getFileUrl(doc);
                      const filename = doc.split("/").pop() || doc;
                      const ext = doc.split('.').pop()?.toLowerCase() || "";
                      const isOffice = ["doc", "docx", "ppt", "pptx", "xls", "xlsx"].includes(ext);
                      const isPdf = ext === "pdf";

                      return (
                        <div key={i} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all bg-gray-50">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0">
                              {getFileIcon(filename)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 text-sm truncate" title={filename}>
                                {filename}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {getFileTypeLabel(filename)} • {getFileSize(filename)}
                              </div>
                              <div className="flex items-center gap-2 mt-3">
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    setModalFull(false);
                                    setModalContent(
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
                                  className="flex items-center gap-1 px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md text-xs font-medium transition-colors"
                                  disabled={!isOffice && !isPdf}
                                >
                                  <Eye className="w-3 h-3" />
                                  Preview
                                </button>
                                <a
                                  href={docUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-xs font-medium transition-colors"
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

              {/* Enhanced Images Section */}
              {mat.media && mat.media.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <FileImage className="w-5 h-5 text-purple-600" />
                    Images ({mat.media.length})
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {mat.media.map((img, i) => (
                      <div
                        key={i}
                        className="group relative cursor-pointer"
                        onClick={e => {
                          e.stopPropagation();
                          setModalFull(false);
                          setModalContent(
                            <div className="p-6 flex flex-col items-center justify-center bg-black/80 min-h-[50vh]">
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
                          className="w-full h-32 object-cover rounded-lg border border-gray-200 group-hover:shadow-lg transition-shadow"
                        />
                        {/* Preview overlay on hover */}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                          <Eye className="w-8 h-8 text-white" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Enhanced YouTube Videos Section */}
              {mat.youtubeLinks && mat.youtubeLinks.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Video className="w-5 h-5 text-red-600" />
                    Videos ({mat.youtubeLinks.length})
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {mat.youtubeLinks.map((url, i) => (
                      <div key={i} className="rounded-lg overflow-hidden border border-gray-200 shadow-sm">
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

              {/* Enhanced Links Section */}
              {mat.links && mat.links.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Link className="w-5 h-5 text-green-600" />
                    Links ({mat.links.length})
                  </h4>
                  <div className="space-y-2">
                    {mat.links.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        className="flex items-center gap-2 p-3 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg transition-all text-blue-600 hover:text-blue-700"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Link className="w-4 h-4 flex-shrink-0" />
                        <span className="text-sm truncate">{url}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Enhanced Modal Preview */}
      {modalContent && (
        <Modal onClose={() => setModalContent(null)} isFull={modalFull} onToggleFull={() => setModalFull(f => !f)}>
          {modalContent}
        </Modal>
      )}
    </div>
  );
}
