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
      <EditorContent editor={editor} />
    </div>
  );
}
