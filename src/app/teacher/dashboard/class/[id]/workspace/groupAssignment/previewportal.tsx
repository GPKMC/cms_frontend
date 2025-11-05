"use client";

import React from "react";
import { createPortal } from "react-dom";

export function PreviewPortal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="relative bg-white rounded-lg overflow-auto max-w-3xl max-h-[90vh] w-full">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-700 text-2xl leading-none"
        >
          ×
        </button>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
