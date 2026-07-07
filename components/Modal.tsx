"use client";

import { useEffect, type ReactNode } from "react";

export default function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-[rgba(6,4,14,0.65)] backdrop-blur-sm transition-opacity duration-200 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`fixed top-1/2 left-1/2 z-50 w-[92vw] sm:w-[520px] max-h-[78vh] overflow-y-auto rounded-[22px] border border-[color:var(--border)] bg-gradient-to-b from-[color:var(--panel-2)] to-[color:var(--panel)] p-6 sm:p-7 shadow-[0_30px_80px_rgba(0,0,0,0.5)] transition-all duration-200 ${
          open
            ? "-translate-x-1/2 -translate-y-1/2 scale-100 opacity-100 pointer-events-auto"
            : "-translate-x-1/2 -translate-y-1/2 scale-95 opacity-0 pointer-events-none"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>
  );
}
