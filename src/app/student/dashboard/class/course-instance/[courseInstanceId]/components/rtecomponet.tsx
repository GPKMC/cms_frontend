"use client";
import React, { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import BulletList from "@tiptap/extension-bullet-list";
import OrderedList from "@tiptap/extension-ordered-list";
import ListItem from "@tiptap/extension-list-item";

export interface TiptapEditorProps {
  content: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function TiptapEditor({
  content,
  onChange,
  placeholder = "Start writing...",
  className = ""
}: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit, Underline, BulletList, OrderedList, ListItem],
    editorProps: {
      attributes: {
        class: `min-h-[150px] p-4 rounded-lg prose prose-sm max-w-none focus:ring-0 ${className}`,
        "data-placeholder": placeholder
      }
    },
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    immediatelyRender: false
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  if (!editor) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
      {/* --- Toolbar --- */}
      <div className="px-2 pt-2">
        {editor && (
          <div className="flex gap-2 border-b border-gray-200 p-2 bg-gray-50 rounded-t-lg">
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`px-2 py-1 rounded ${editor.isActive('bold') ? 'bg-blue-100 text-blue-700 font-bold' : ''}`}
              title="Bold"
            >
              <b>B</b>
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`px-2 py-1 rounded ${editor.isActive('italic') ? 'bg-purple-100 text-purple-700 italic' : ''}`}
              title="Italic"
            >
              <i>I</i>
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={`px-2 py-1 rounded ${editor.isActive('underline') ? 'bg-green-100 text-green-700 underline' : ''}`}
              title="Underline"
            >
              <u>U</u>
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`px-2 py-1 rounded ${editor.isActive('bulletList') ? 'bg-orange-100 text-orange-700' : ''}`}
              title="Unordered List"
            >
              • List
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={`px-2 py-1 rounded ${editor.isActive('orderedList') ? 'bg-yellow-100 text-yellow-700' : ''}`}
              title="Ordered List"
            >
              1. List
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
              className="px-2 py-1 rounded bg-red-50 text-red-700"
              title="Clear Formatting"
            >
              Clear
            </button>
          </div>
        )}
      </div>
      {/* --- Editor Content --- */}
      <EditorContent editor={editor} />
    </div>
  );
}
