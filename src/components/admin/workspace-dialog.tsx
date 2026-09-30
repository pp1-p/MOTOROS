"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode, RefObject } from "react";

import { cn } from "@/lib/utils";

/** Reuse the existing accessible dialog primitive without moving outside the
 * admin theme. Radix manages focus trapping, Escape and background scroll. */
export function WorkspaceDialog({
  open,
  onOpenChange,
  title,
  children,
  className,
  returnFocusRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  className?: string;
  returnFocusRef: RefObject<HTMLElement | null>;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Overlay className="fixed inset-0 z-[70]" />
      <Dialog.Content
        data-workspace-dialog=""
        className={cn(
          "workspace-dialog fixed inset-0 z-[70] flex items-center justify-center bg-[#09100e]/45 p-4 backdrop-blur-sm",
          className,
        )}
        aria-describedby={undefined}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onOpenChange(false);
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          // A keyboard shortcut can replace this dialog with another one.
          // Let the new dialog retain focus until the entire modal flow closes.
          if (!document.querySelector('[data-workspace-dialog][data-state="open"]')) {
            returnFocusRef.current?.focus();
          }
        }}
      >
        <Dialog.Title className="sr-only">{title}</Dialog.Title>
        {children}
      </Dialog.Content>
    </Dialog.Root>
  );
}
