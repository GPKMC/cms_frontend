"use client";
import { useEffect, useState } from "react";

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
  if (file.startsWith("/uploads/")) return `${process.env.NEXT_PUBLIC_BACKEND_URL}${file}`;
  // If it's already prefixed with folder, handle it:
  return `${process.env.NEXT_PUBLIC_BACKEND_URL}/uploads/${file.replace(/^uploads\//, "")}`;
}

// Modal component (no JSX error if file is .tsx)
function Modal({ children, onClose, isFull, onToggleFull }: { children: React.ReactNode, onClose: () => void, isFull: boolean, onToggleFull: () => void }) {
  return (
    <div className={`fixed inset-0 z-50 bg-black/40 flex items-center justify-center ${isFull ? "p-0" : "p-4"}`}>
      <div className={`bg-white rounded-lg shadow-lg w-full ${isFull ? "h-full" : "max-w-3xl max-h-[90vh]"} relative flex flex-col`}>
        <button className="absolute top-2 right-3 text-xl" onClick={onClose}>✕</button>
        <button
          className="absolute top-2 right-10 bg-gray-200 px-2 rounded text-xs"
          onClick={onToggleFull}
        >
          {isFull ? "Exit Fullscreen" : "Fullscreen"}
        </button>
        <div className={`overflow-auto ${isFull ? "h-full" : ""}`}>{children}</div>
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
    const token =
      localStorage.getItem("token_teacher") ||
      sessionStorage.getItem("token_teacher") ||
      "";
    setLoading(true);
    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/course-materials/course/${courseInstanceId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setMaterials(data.materials || []))
      .finally(() => setLoading(false));
  }, [courseInstanceId]);

  if (loading) return <div>Loading materials...</div>;
  if (materials.length === 0) return <div>No materials posted yet.</div>;

  return (
    <div className="my-6 flex flex-col gap-3">
      {materials.map((mat) => (
        <div key={mat._id} className="relative">
          {/* Material row */}
          <div
            className={`border rounded-lg bg-white p-4 shadow flex items-center justify-between cursor-pointer hover:border-blue-400 transition ${
              expandedId === mat._id ? "border-blue-600 bg-blue-50" : ""
            }`}
            onClick={() => setExpandedId(expandedId === mat._id ? null : mat._id)}
          >
            <div>
              <div className="text-base font-semibold">{mat.title}</div>
              <div className="text-xs text-gray-500">
                Posted by: {mat.postedBy?.username || mat.postedBy?.email || "Unknown"} &bull;{" "}
                {new Date(mat.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
            <div className="text-xs text-gray-400">{expandedId === mat._id ? "▲" : "▼"}</div>
          </div>
          {/* Expanded content */}
          {expandedId === mat._id && (
            <div className="p-5 border border-t-0 border-blue-600 rounded-b-lg bg-white">
             <div className="announcement-content prose" dangerouslySetInnerHTML={{ __html: mat.content }} />

              {/* Images */}
              {mat.media && mat.media.length > 0 && (
                <div className="flex gap-2 my-2 flex-wrap">
                  {mat.media.map((img, i) => (
                    <img
                      key={i}
                      src={getFileUrl(img)}
                      alt="Material image"
                      className="w-32 h-20 object-cover rounded border cursor-pointer"
                      onClick={e => {
                        e.stopPropagation();
                        setModalFull(false);
                        setModalContent(
                          <img src={getFileUrl(img)} className="max-h-[80vh] mx-auto" alt="Preview" />
                        );
                      }}
                    />
                  ))}
                </div>
              )}
              {/* Documents */}
              {mat.documents && mat.documents.length > 0 && (
                <div className="flex gap-2 my-2 flex-wrap">
                  {mat.documents.map((doc, i) => {
                    const docUrl = getFileUrl(doc);
                    const ext = doc.split('.').pop()?.toLowerCase() || "";
                    const isOffice = ["doc", "docx", "ppt", "pptx", "xls", "xlsx"].includes(ext);
                    const isPdf = ext === "pdf";
                    return (
                      <div key={i}>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setModalFull(false);
                            setModalContent(
                              isOffice ? (
                                <iframe
                                  src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(docUrl)}`}
                                  style={{ width: "100%", height: "80vh", border: "none" }}
                                />
                              ) : isPdf ? (
                                <iframe src={docUrl} style={{ width: "100%", height: "80vh", border: "none" }} />
                              ) : (
                                <a href={docUrl} target="_blank" rel="noopener noreferrer">
                                  Download file
                                </a>
                              )
                            );
                          }}
                          className="bg-gray-100 rounded px-3 py-2 text-xs border hover:bg-blue-50"
                        >
                          {doc.split("/").pop()}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* YouTube Videos */}
              {mat.youtubeLinks && mat.youtubeLinks.length > 0 && (
                <div className="flex gap-2 my-2">
                  {mat.youtubeLinks.map((url, i) => (
                    <iframe
                      key={i}
                      src={getYoutubeEmbed(url)}
                      title="YouTube"
                      className="rounded border"
                      width={340}
                      height={180}
                      allowFullScreen
                    />
                  ))}
                </div>
              )}
              {/* Links */}
              {mat.links && mat.links.length > 0 && (
                <div className="flex flex-col gap-2 my-2">
                  {mat.links.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      className="text-blue-600 underline text-xs"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {url}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Modal Preview */}
      {modalContent && (
        <Modal onClose={() => setModalContent(null)} isFull={modalFull} onToggleFull={() => setModalFull(f => !f)}>
          {modalContent}
        </Modal>
      )}
    </div>
  );
}