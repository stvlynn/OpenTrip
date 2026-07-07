import { Button } from "@/shared/ui/button";

export interface SearchPopupProps {
  name: string;
  addLabel: string;
  onAdd: () => void;
}

export function SearchPopup({ name, addLabel, onAdd }: SearchPopupProps) {
  return (
    <div className="flex min-w-[160px] max-w-[220px] flex-col gap-2">
      <span className="text-sm font-medium leading-tight text-foreground">
        {name}
      </span>
      <Button type="button" size="sm" className="h-7 text-xs" onClick={onAdd}>
        {addLabel}
      </Button>
    </div>
  );
}
