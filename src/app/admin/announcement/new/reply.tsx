'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  MessageSquare,
  CornerDownRight,
  Reply as ReplyIcon,
  Send,
  Paperclip,
  Loader2,
  Trash2,
  RotateCcw,
  Edit3,
  X,
  Image as ImageIcon,
  File as FileIcon,
} from 'lucide-react';
// If you already use TipTap in your project, uncomment next line and use the <RTE /> below.
// import TiptapEditor from '../notification_rte_comenent';

/* ========= API CONFIG (mirrors your style) ========= */
const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000').replace(/\/$/, '');
const EP = {
  upload: `${BACKEND}/reply/upload`,
  listRoot: (annId: string, page: number, limit: number, sort: 'asc' | 'desc', adminView?: boolean) =>
    `${BACKEND}/reply/announcement/${annId}/replies?parent=null&page=${page}&limit=${limit}&sort=${sort}${
      adminView ? '&adminView=true' : ''
    }`,
  listChildren: (replyId: string, page: number, limit: number, sort: 'asc' | 'desc', adminView?: boolean) =>
    `${BACKEND}/reply/${replyId}/children?page=${page}&limit=${limit}&sort=${sort}${
      adminView ? '&adminView=true' : ''
    }`,
  create: (annId: string, adminView?: boolean) =>
    `${BACKEND}/reply/announcement/${annId}/replies${adminView ? '?adminView=true' : ''}`,
  patch: (replyId: string) => `${BACKEND}/reply/${replyId}`,
  del: (replyId: string, hard = false) => `${BACKEND}/reply/${replyId}${hard ? '?hard=true' : ''}`,
  restore: (replyId: string) => `${BACKEND}/reply/${replyId}/restore`,
};

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token_admin') || localStorage.getItem('token') || '';
}
function authHeaders(json = true): Record<string, string> {
  const t = getToken();
  const h: Record<string, string> = t ? { Authorization: `Bearer ${t}` } : {};
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

/* ========= Types ========= */
type ReplyFile = { url: string; originalname?: string; filetype?: string; size?: number; caption?: string };
type Reply = {
  _id: string;
  announcement: string;
  parent: string | null;
  author: string; // id (not populated)
  contentHtml: string;
  files?: ReplyFile[];
  isDeleted?: boolean;
  createdAt: string;
  updatedAt: string;
  editedAt?: string | null;
};

type RepliesResponse = { page: number; limit: number; total: number; data: Reply[] };

/* ========= Utils ========= */
const fmt = (s?: string) => (s ? new Date(s).toLocaleString() : '—');
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const BYTES = (n?: number) =>
  n == null ? '' : n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 ** 2).toFixed(1)} MB`;

async function uploadFiles(files: File[]): Promise<ReplyFile[]> {
  if (!files.length) return [];
  const fd = new FormData();
  files.forEach((f) => fd.append('files', f));
  const res = await fetch(EP.upload, { method: 'POST', headers: { ...authHeaders(false) }, body: fd });
  if (!res.ok) throw new Error((await res.text().catch(() => '')) || 'Upload failed');
  const data = await res.json();
  return (data.files || []) as ReplyFile[];
}

/* ========= Minimal RTE (fallback) ========= */
// If you have TipTapEditor, swap this with it.
function RTE({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="rounded-lg border bg-white">
      <textarea
        value={value.replace(/<br\s*\/?>/gi, '\n').replace(/<\/?p>/gi, '')}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full min-h-[80px] p-3 outline-none"
      />
      <div className="px-3 py-1.5 border-t text-[11px] text-gray-500 bg-gray-50">Content is saved as HTML.</div>
    </div>
  );
}

/* ========= Main Component ========= */
export default function AnnouncementReplies({
  announcementId,
  currentUserId,
  isAdmin,
  adminView = true, // let admins view unpublished when embedded in admin panel
  pageSize = 10,
  sort = 'asc',
}: {
  announcementId: string;
  currentUserId?: string;
  isAdmin?: boolean;
  adminView?: boolean;
  pageSize?: number;
  sort?: 'asc' | 'desc';
}) {
  const [loading, setLoading] = useState(false);
  const [root, setRoot] = useState<Reply[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Composer state (root)
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const pages = useMemo(() => Math.max(1, Math.ceil((total || 0) / pageSize)), [total, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [announcementId, pageSize, sort]);

  useEffect(() => {
    void fetchRoot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [announcementId, page, pageSize, sort]);

  async function fetchRoot() {
    try {
      setLoading(true);
      const res = await fetch(EP.listRoot(announcementId, page, pageSize, sort, adminView), {
        headers: { ...authHeaders(false) },
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`Failed to load replies (${res.status})`);
      const json: RepliesResponse = await res.json();
      setRoot(json.data || []);
      setTotal(json.total || 0);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load replies');
      setRoot([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  async function postReply(parent?: string | null) {
    if (!content.trim() && files.length === 0) {
      toast.error('Please write something or attach a file.');
      return;
    }
    setSubmitting(true);
    try {
      const uploaded = await uploadFiles(files);
      const payload = {
        contentHtml: content.trim() ? contentToHtml(content) : '',
        files: uploaded,
        parent: parent ?? null,
      };
      const res = await fetch(EP.create(announcementId, adminView), {
        method: 'POST',
        headers: { ...authHeaders(true) },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Could not post reply');
      }
      toast.success('Reply posted');
      // reset
      setContent('');
      setFiles([]);
      // refresh root (or child handled by child composer)
      if (!parent) await fetchRoot();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to post reply');
    } finally {
      setSubmitting(false);
    }
  }

  function onPickFiles(input: HTMLInputElement) {
    const picked = Array.from(input.files || []);
    if (!picked.length) return;
    setFiles((prev) => {
      const map = new Map(prev.map((f) => [`${f.name}:${f.size}:${f.lastModified}`, f]));
      picked.forEach((f) => map.set(`${f.name}:${f.size}:${f.lastModified}`, f));
      return Array.from(map.values());
    });
    input.value = '';
  }

  return (
    <div className="bg-white/90 backdrop-blur rounded-2xl border shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-gradient-to-r from-indigo-600 to-purple-600 rounded-t-2xl text-white flex items-center gap-2">
        <MessageSquare className="w-5 h-5" />
        <h3 className="font-semibold">Discussion</h3>
        <span className="ml-auto text-xs opacity-80">{total} total</span>
      </div>

      {/* Root composer */}
      <div className="p-4 border-b">
        {/* Swap <RTE /> with <TiptapEditor /> if you have it */}
        {/* <TiptapEditor content={content} onChange={setContent} placeholder="Write a reply..." /> */}
        <RTE value={content} onChange={setContent} placeholder="Write a reply..." />

        {/* attachments */}
        <div className="mt-3 flex items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-sm px-3 py-2 border rounded cursor-pointer hover:bg-gray-50">
            <Paperclip className="w-4 h-4" />
            Attach files
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => onPickFiles(e.currentTarget)}
            />
          </label>

          <button
            onClick={() => postReply(null)}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Post reply
          </button>
        </div>

        {/* selected files preview */}
        {files.length > 0 && (
          <div className="mt-3 space-y-2">
            {files.map((f, i) => (
              <div key={`${f.name}-${i}`} className="flex items-center gap-3 text-sm bg-gray-50 border rounded p-2">
                <FileIcon className="w-4 h-4 text-gray-600" />
                <div className="flex-1 min-w-0">
                  <div className="truncate">{f.name}</div>
                  <div className="text-xs text-gray-500">{BYTES(f.size)}</div>
                </div>
                <button
                  className="p-1 rounded hover:bg-gray-200"
                  onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Root list */}
      <div className="divide-y">
        {loading ? (
          <div className="p-6 text-sm text-gray-500">Loading replies…</div>
        ) : root.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">No replies yet. Be the first to comment!</div>
        ) : (
          root.map((r) => (
            <ReplyItem
              key={r._id}
              reply={r}
              currentUserId={currentUserId}
              isAdmin={!!isAdmin}
              adminView={adminView}
              onChanged={fetchRoot}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="px-4 py-3 border-t bg-gray-50 rounded-b-2xl flex items-center justify-between text-sm">
          <div className="text-gray-600">
            Page {page} / {pages}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-3 py-1 border rounded disabled:opacity-50"
              disabled={page <= 1}
              onClick={() => setPage((p) => clamp(p - 1, 1, pages))}
            >
              Prev
            </button>
            <button
              className="px-3 py-1 border rounded disabled:opacity-50"
              disabled={page >= pages}
              onClick={() => setPage((p) => clamp(p + 1, 1, pages))}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ========= Child Components ========= */
function ReplyItem({
  reply,
  currentUserId,
  isAdmin,
  adminView,
  onChanged,
}: {
  reply: Reply;
  currentUserId?: string;
  isAdmin: boolean;
  adminView: boolean;
  onChanged: () => void;
}) {
  const canEdit = isAdmin || (!!currentUserId && currentUserId === reply.author);

  // children state
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<Reply[]>([]);
  const [cPage, setCPage] = useState(1);
  const [cTotal, setCTotal] = useState(0);
  const [cLoading, setCLoading] = useState(false);
  const [cSubmitting, setCSubmitting] = useState(false);

  // child composer
  const [cContent, setCContent] = useState('');
  const [cFiles, setCFiles] = useState<File[]>([]);

  const cPages = useMemo(() => Math.max(1, Math.ceil((cTotal || 0) / 10)), [cTotal]);

  async function fetchChildren(page = 1) {
    if (!expanded) return;
    try {
      setCLoading(true);
      const res = await fetch(EP.listChildren(reply._id, page, 10, 'asc', adminView), {
        headers: { ...authHeaders(false) },
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed to load child replies');
      const json: RepliesResponse = await res.json();
      setChildren(json.data || []);
      setCTotal(json.total || 0);
      setCPage(page);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load replies');
    } finally {
      setCLoading(false);
    }
  }

  useEffect(() => {
    if (expanded) void fetchChildren(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  function onPickChildFiles(input: HTMLInputElement) {
    const picked = Array.from(input.files || []);
    if (!picked.length) return;
    setCFiles((prev) => {
      const map = new Map(prev.map((f) => [`${f.name}:${f.size}:${f.lastModified}`, f]));
      picked.forEach((f) => map.set(`${f.name}:${f.size}:${f.lastModified}`, f));
      return Array.from(map.values());
    });
    input.value = '';
  }

  async function postChild() {
    if (!cContent.trim() && cFiles.length === 0) {
      toast.error('Please write something or attach a file.');
      return;
    }
    setCSubmitting(true);
    try {
      const uploaded = await uploadFiles(cFiles);
      const payload = {
        contentHtml: contentToHtml(cContent),
        files: uploaded,
        parent: reply._id,
      };
      const res = await fetch(EP.create(reply.announcement, adminView), {
        method: 'POST',
        headers: { ...authHeaders(true) },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Could not post reply');
      toast.success('Reply posted');
      setCContent('');
      setCFiles([]);
      await fetchChildren(cPage); // refresh child list
    } catch (e: any) {
      toast.error(e?.message || 'Failed to post reply');
    } finally {
      setCSubmitting(false);
    }
  }

  async function onDelete() {
    if (!confirm('Delete this reply? (Soft delete)')) return;
    try {
      const res = await fetch(EP.del(reply._id), { method: 'DELETE', headers: { ...authHeaders(false) } });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Delete failed');
      }
      toast.success('Reply deleted');
      // If this is a child item, parent caller will refresh; Here we assume root item
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete');
    }
  }

  async function onRestore() {
    try {
      const res = await fetch(EP.restore(reply._id), { method: 'POST', headers: { ...authHeaders(false) } });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Restore failed');
      }
      toast.success('Reply restored');
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to restore');
    }
  }

  return (
    <div className="p-4">
      {/* One reply */}
      <div className={`rounded-lg border ${reply.isDeleted ? 'bg-red-50/40 border-red-200' : 'bg-white'}`}>
        <div className="p-3 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 grid place-items-center text-xs shrink-0">
            {/* Initials-like bubble using short id */}
            {String(reply.author || '').slice(-2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="font-medium text-gray-700">User</span>
              <span>·</span>
              <span>{fmt(reply.createdAt)}</span>
              {reply.editedAt && (
                <>
                  <span>·</span>
                  <span className="italic">edited {fmt(reply.editedAt)}</span>
                </>
              )}
              {reply.isDeleted && (
                <>
                  <span>·</span>
                  <span className="text-red-600 font-medium">deleted</span>
                </>
              )}
            </div>

            {/* Content */}
            {!reply.isDeleted ? (
              reply.contentHtml ? (
                <div
                  className="prose prose-sm max-w-none mt-2"
                  // IMPORTANT: sanitize on server before storing contentHtml
                  dangerouslySetInnerHTML={{ __html: reply.contentHtml }}
                />
              ) : null
            ) : (
              <div className="text-sm text-gray-500 mt-2 italic">This reply was deleted.</div>
            )}

            {/* Files */}
            {Array.isArray(reply.files) && reply.files.length > 0 && !reply.isDeleted && (
              <div className="mt-3 space-y-2">
                {reply.files.map((f, i) => (
                  <a
                    key={i}
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 p-2 bg-gray-50 hover:bg-gray-100 border rounded text-sm"
                  >
                    {f.filetype?.startsWith('image/') ? (
                      <ImageIcon className="w-4 h-4 text-gray-700" />
                    ) : (
                      <FileIcon className="w-4 h-4 text-gray-700" />
                    )}
                    <span className="truncate">{f.originalname || f.url.split('/').pop()}</span>
                    {f.size ? <span className="ml-auto text-xs text-gray-500">{BYTES(f.size)}</span> : null}
                  </a>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <button
                className="inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-gray-50"
                onClick={() => setExpanded((e) => !e)}
              >
                <ReplyIcon className="w-3.5 h-3.5" />
                {expanded ? 'Hide thread' : 'Reply'}
              </button>

              {canEdit && !reply.isDeleted && (
                <button
                  className="inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-gray-50"
                  onClick={onDelete}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              )}

              {canEdit && reply.isDeleted && (
                <button
                  className="inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-gray-50"
                  onClick={onRestore}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restore
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Children thread */}
        {expanded && (
          <div className="border-t bg-gray-50/50 p-3 pl-6">
            {/* child composer */}
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-2 text-xs text-gray-600">
                <CornerDownRight className="w-3.5 h-3.5" />
                Reply to this thread
              </div>
              {/* <TiptapEditor content={cContent} onChange={setCContent} placeholder="Write a nested reply…" /> */}
              <RTE value={cContent} onChange={setCContent} placeholder="Write a nested reply…" />

              <div className="mt-2 flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-xs px-2 py-1.5 border rounded cursor-pointer hover:bg-white">
                  <Paperclip className="w-3.5 h-3.5" />
                  Attach
                  <input type="file" multiple className="hidden" onChange={(e) => onPickChildFiles(e.currentTarget)} />
                </label>
                <button
                  onClick={postChild}
                  disabled={cSubmitting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 text-xs"
                >
                  {cSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Reply
                </button>
              </div>

              {cFiles.length > 0 && (
                <div className="mt-2 space-y-1">
                  {cFiles.map((f, i) => (
                    <div key={`${f.name}-${i}`} className="flex items-center gap-2 text-xs bg-white border rounded p-1.5">
                      <FileIcon className="w-3.5 h-3.5 text-gray-600" />
                      <div className="flex-1 truncate">{f.name}</div>
                      <div className="text-[10px] text-gray-500">{BYTES(f.size)}</div>
                      <button className="p-1 hover:bg-gray-100 rounded" onClick={() => setCFiles((prev) => prev.filter((_, idx) => idx !== i))}>
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* children list */}
            <div className="space-y-2">
              {cLoading ? (
                <div className="text-xs text-gray-500">Loading thread…</div>
              ) : children.length === 0 ? (
                <div className="text-xs text-gray-500">No replies yet.</div>
              ) : (
                children.map((ch) => (
                  <div key={ch._id} className={`pl-4 border-l ${ch.isDeleted ? 'border-red-200' : 'border-gray-200'}`}>
                    <div className="text-[11px] text-gray-500 mb-1">
                      <span className="font-medium text-gray-700">User</span> · {fmt(ch.createdAt)}
                      {ch.editedAt ? ` · edited ${fmt(ch.editedAt)}` : ''}
                      {ch.isDeleted ? ' · deleted' : ''}
                    </div>
                    {!ch.isDeleted ? (
                      ch.contentHtml && (
                        <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: ch.contentHtml }} />
                      )
                    ) : (
                      <div className="text-xs text-gray-500 italic">This reply was deleted.</div>
                    )}
                    {Array.isArray(ch.files) && ch.files.length > 0 && !ch.isDeleted && (
                      <div className="mt-2 space-y-1">
                        {ch.files.map((f, i) => (
                          <a
                            key={i}
                            className="flex items-center gap-2 p-1.5 bg-white border rounded text-xs hover:bg-gray-50"
                            href={f.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {f.filetype?.startsWith('image/') ? (
                              <ImageIcon className="w-3.5 h-3.5" />
                            ) : (
                              <FileIcon className="w-3.5 h-3.5" />
                            )}
                            <span className="truncate">{f.originalname || f.url.split('/').pop()}</span>
                            {f.size ? <span className="ml-auto text-[10px] text-gray-500">{BYTES(f.size)}</span> : null}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* child pagination */}
            {cPages > 1 && (
              <div className="mt-3 flex items-center justify-between text-[11px]">
                <span className="text-gray-600">
                  Page {cPage} / {cPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    className="px-2 py-1 border rounded disabled:opacity-50"
                    disabled={cPage <= 1}
                    onClick={() => fetchChildren(cPage - 1)}
                  >
                    Prev
                  </button>
                  <button
                    className="px-2 py-1 border rounded disabled:opacity-50"
                    disabled={cPage >= cPages}
                    onClick={() => fetchChildren(cPage + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ========= tiny helper ========= */
function contentToHtml(s: string) {
  // Convert plaintext to simple HTML paragraphs. Replace this with real RTE html if you use TipTap.
  const esc = (x: string) =>
    x
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  const lines = s.split(/\n{2,}/g).map((p) => `<p>${esc(p).replace(/\n/g, '<br/>')}</p>`);
  return lines.join('');
}
