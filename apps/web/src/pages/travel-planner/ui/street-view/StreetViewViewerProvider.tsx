import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiError, fetchStreetViewViewerConfig } from "@/shared/api";
import { StreetViewDialog } from "./StreetViewDialog";

interface StreetViewViewerContextValue {
  tripId: string;
  enabled: boolean;
  openStreetView: (imageId: string) => void;
}

const StreetViewViewerContext = createContext<StreetViewViewerContextValue | null>(null);

export function StreetViewViewerProvider({ tripId, children }: { tripId: string; children: ReactNode }) {
  const [imageId, setImageId] = useState<string | null>(null);
  const configQuery = useQuery({
    queryKey: ["street-view", tripId, "viewer-config"],
    queryFn: () => fetchStreetViewViewerConfig(tripId),
    staleTime: 30 * 60 * 1000,
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 2,
  });
  const openStreetView = useCallback((id: string) => setImageId(id), []);
  const value = useMemo(
    () => ({ tripId, enabled: configQuery.isSuccess, openStreetView }),
    [configQuery.isSuccess, openStreetView, tripId],
  );

  return (
    <StreetViewViewerContext.Provider value={value}>
      {children}
      <StreetViewDialog
        open={imageId !== null}
        imageId={imageId}
        viewerConfig={configQuery.data ?? null}
        onOpenChange={(open) => {
          if (!open) setImageId(null);
        }}
      />
    </StreetViewViewerContext.Provider>
  );
}

export function useStreetViewViewer(): StreetViewViewerContextValue {
  const value = useContext(StreetViewViewerContext);
  if (!value) throw new Error("useStreetViewViewer must be used inside StreetViewViewerProvider");
  return value;
}

