import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import type { StreetViewViewerConfig } from "@/shared/api";
import type { Viewer as MapillaryViewer } from "mapillary-js";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPortal,
  DialogSheetPopup,
  DialogSheetViewport,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Spinner } from "@/shared/ui/spinner";
import "mapillary-js/dist/mapillary.css";

export function StreetViewDialog({
  open,
  imageId,
  viewerConfig,
  onOpenChange,
}: {
  open: boolean;
  imageId: string | null;
  viewerConfig: StreetViewViewerConfig | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("planner");
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open || !imageId || !viewerConfig || !containerRef.current) return;
    let disposed = false;
    let viewer: MapillaryViewer | null = null;
    const loadTimeout = window.setTimeout(() => {
      if (!disposed) setState("error");
    }, 15_000);
    setState("loading");
    void import("mapillary-js")
      .then(({ Viewer }) => {
        if (disposed || !containerRef.current) return;
        if (viewerConfig.provider !== "mapillary") throw new Error("Unsupported street-view viewer");
        viewer = new Viewer({
          accessToken: viewerConfig.accessToken,
          container: containerRef.current,
          imageId,
        });
        viewer.on("load", () => {
          window.clearTimeout(loadTimeout);
          if (!disposed) setState("ready");
        });
      })
      .catch(() => {
        window.clearTimeout(loadTimeout);
        if (!disposed) setState("error");
      });
    return () => {
      disposed = true;
      window.clearTimeout(loadTimeout);
      viewer?.remove();
    };
  }, [attempt, imageId, open, viewerConfig]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm" />
        <DialogSheetViewport>
          <DialogSheetPopup size="lg" className="overflow-hidden p-0">
            <DialogHeader className="flex-row items-start justify-between gap-3 px-4 py-3">
              <div>
                <DialogTitle>{t("streetView.dialog.title")}</DialogTitle>
                <DialogDescription>{t("streetView.dialog.description")}</DialogDescription>
              </div>
              <DialogClose aria-label={t("streetView.dialog.close")} className="rounded-md p-2 hover:bg-accent">
                <X className="size-4" />
              </DialogClose>
            </DialogHeader>
            <DialogPanel className="relative h-[min(70vh,720px)] min-h-80 p-0">
              <div ref={containerRef} className="absolute inset-0" />
              {state === "loading" ? (
                <div className="absolute inset-0 grid place-items-center bg-card">
                  <Spinner className="size-5" />
                </div>
              ) : null}
              {state === "error" ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card p-6 text-center">
                  <p className="text-sm text-muted-foreground">{t("streetView.dialog.error")}</p>
                  <Button type="button" variant="outline" onClick={() => setAttempt((value) => value + 1)}>
                    {t("streetView.dialog.retry")}
                  </Button>
                </div>
              ) : null}
            </DialogPanel>
          </DialogSheetPopup>
        </DialogSheetViewport>
      </DialogPortal>
    </Dialog>
  );
}
