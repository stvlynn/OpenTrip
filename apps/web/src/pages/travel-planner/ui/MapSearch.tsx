import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PlaceResult } from "@/shared/api";
import {
  Autocomplete,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
  AutocompletePopup,
  AutocompleteStatus,
} from "@/shared/ui/autocomplete";
import { usePlaceSearch } from "../model/usePlaceSearch";

export interface MapSearchProps {
  value: string;
  onValueChange: (value: string) => void;
  onSelect: (place: PlaceResult) => void;
  placeholder: string;
  biasLat?: number;
  biasLng?: number;
}

/** Floating map search: Photon-backed autocomplete that stays out of the
 * composer's "pick on map" flow. */
export function MapSearch({
  value,
  onValueChange,
  onSelect,
  placeholder,
  biasLat,
  biasLng,
}: MapSearchProps) {
  const { t } = useTranslation("planner");
  const [open, setOpen] = useState(false);
  const highlightedRef = useRef<PlaceResult | undefined>(undefined);
  const { results, isFetching, enabled } = usePlaceSearch(
    value,
    biasLat,
    biasLng,
  );

  return (
    <Autocomplete
      items={results}
      value={value}
      open={open}
      onOpenChange={setOpen}
      mode="none"
      itemToStringValue={(item: PlaceResult) => item.label}
      onItemHighlighted={(item) => {
        highlightedRef.current = item;
      }}
      onValueChange={(next, details) => {
        if (details.reason === "item-press") {
          const picked =
            highlightedRef.current ??
            results.find((r) => r.label === next);
          if (picked) {
            onSelect(picked);
            onValueChange(picked.label);
          } else {
            onValueChange(next);
          }
          setOpen(false);
        } else {
          onValueChange(next);
          setOpen(next.trim().length >= 2);
        }
      }}
    >
      <AutocompleteInput
        className="rounded-lg"
        placeholder={placeholder}
        showClear
        startAddon={
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        }
      />
      <AutocompletePopup>
        {isFetching ? (
          <AutocompleteStatus>{t("pick.searching")}</AutocompleteStatus>
        ) : null}
        <AutocompleteEmpty>
          {enabled && !isFetching ? t("pick.noResults") : ""}
        </AutocompleteEmpty>
        <AutocompleteList>
          {(item: PlaceResult) => (
            <AutocompleteItem key={item.id} value={item}>
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{item.label}</span>
                {item.secondary ? (
                  <span className="truncate text-xs text-muted-foreground text-pretty">
                    {item.secondary}
                  </span>
                ) : null}
              </span>
            </AutocompleteItem>
          )}
        </AutocompleteList>
      </AutocompletePopup>
    </Autocomplete>
  );
}
