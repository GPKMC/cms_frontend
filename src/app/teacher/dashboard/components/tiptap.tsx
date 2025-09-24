"use client";

import React, { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import CharacterCount from "@tiptap/extension-character-count";
import { Bold, Italic, List as ListIcon, ListOrdered, RotateCcw, Type as TypeIcon, Undo2, Redo2, Maximize2, Minimize2 } from "lucide-react";

type Props = {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string; // visual only (we’ll fake it)
  className?: string;
  editable?: boolean;
};

export default function TiptapEditorBasic({
  content,
  onChange,
  placeholder = "Start writing…",
  className = "",
  editable = true,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  const editor = useEditor({
    editable,
    extensions: [
      StarterKit,
      CharacterCount.configure({
        limit: 5000, // Optional character limit
      }),
    ],
    editorProps: {
      attributes: {
        class: `${isExpanded ? 'min-h-[400px] max-h-[600px]' : 'min-h-[200px] max-h-[400px]'} overflow-y-auto p-4 rounded-lg outline-none prose prose-sm max-w-none focus:ring-0 resize-none ${className}`,
        'aria-label': 'Rich text editor',
      },
    },
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (current !== content) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [editor, content]);

  if (!editor) return null;

  const Btn = ({
    onClick,
    active,
    title,
    children,
    disabled,
  }: React.PropsWithChildren<{
    onClick: () => void;
    active?: boolean;
    title: string;
    disabled?: boolean;
  }>) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 text-sm rounded-lg border transition-all duration-200
        ${disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-100 hover:shadow-sm transform hover:scale-105"}
        ${active 
          ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white border-blue-600 shadow-md" 
          : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
        }`}
    >
      {children}
    </button>
  );

  const wordCount = editor.storage.characterCount?.words() || 0;
  const charCount = editor.storage.characterCount?.characters() || 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-3 bg-gradient-to-r from-gray-50 to-blue-50/50 border-b">
        <div className="flex items-center gap-1">
          <Btn onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive("paragraph")} title="Paragraph">
            <TypeIcon className="w-4 h-4" />
            <span className="text-xs hidden sm:inline">P</span>
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="Heading 1">
            <TypeIcon className="w-4 h-4" />
            <span className="text-xs hidden sm:inline">H1</span>
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2">
            <TypeIcon className="w-4 h-4" />
            <span className="text-xs hidden sm:inline">H2</span>
          </Btn>
        </div>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <div className="flex items-center gap-1">
          <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
            <Bold className="w-4 h-4" />
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
            <Italic className="w-4 h-4" />
          </Btn>
        </div>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <div className="flex items-center gap-1">
          <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet list">
            <ListIcon className="w-4 h-4" />
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered list">
            <ListOrdered className="w-4 h-4" />
          </Btn>
        </div>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <div className="flex items-center gap-1">
          <Btn onClick={() => editor.chain().focus().undo().run()} title="Undo" disabled={!editor.can().undo()}>
            <Undo2 className="w-4 h-4" />
          </Btn>
          <Btn onClick={() => editor.chain().focus().redo().run()} title="Redo" disabled={!editor.can().redo()}>
            <Redo2 className="w-4 h-4" />
          </Btn>
        </div>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <Btn onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title="Clear formatting">
          <RotateCcw className="w-4 h-4" />
          <span className="text-xs hidden sm:inline">Clear</span>
        </Btn>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <Btn 
          onClick={() => setIsExpanded(!isExpanded)} 
          title={isExpanded ? "Collapse editor" : "Expand editor"}
          active={isExpanded}
        >
          {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          <span className="text-xs hidden sm:inline">{isExpanded ? "Collapse" : "Expand"}</span>
        </Btn>

        {/* Word/Character Count */}
        <div className="ml-auto flex items-center gap-2">
          <div className="text-xs text-gray-500 bg-white px-2 py-1 rounded-md border">
            <span className="hidden sm:inline">{wordCount} words • </span>
            {charCount}{charCount >= 4500 ? "/5000" : ""} chars
            {charCount >= 4500 && <span className="text-orange-500 ml-1">⚠️</span>}
          </div>
        </div>
      </div>

      {/* Content + placeholder */}
      <div className="relative">
        <EditorContent 
          editor={editor} 
          className="focus-within:bg-gradient-to-br focus-within:from-blue-50/30 focus-within:to-indigo-50/20 transition-all duration-200" 
        />
        {editor.isEmpty && (
          <div className="absolute top-4 left-4 text-gray-400 pointer-events-none select-none text-sm leading-relaxed whitespace-pre-line">
            {placeholder}
          </div>
        )}
        
        {/* Keyboard shortcuts help */}
        {editor && !editor.isEmpty && (
          <div className="absolute bottom-2 right-2 text-xs text-gray-400 bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-sm border">
            <div className="hidden lg:flex items-center gap-3 text-[10px]">
              <span>Ctrl+B <strong>Bold</strong></span>
              <span>Ctrl+I <em>Italic</em></span>
              <span>Ctrl+Z Undo</span>
              <span>Ctrl+A Select all</span>
            </div>
            <div className="lg:hidden">
              Use toolbar for formatting
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
