import { useEffect } from "react";

/**
 * Syncs `document.title` while the caller is mounted and restores the
 * previous title on unmount.
 */
export function useDocumentTitle(title: string | undefined): void {
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
