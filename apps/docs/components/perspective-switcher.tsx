"use client";

import { Dialog } from "@base-ui/react/dialog";
import { BookOpen, Check, ChevronDown, Code2, X } from "lucide-react";
import { useRouter } from "next/navigation";

const perspectives = [
  {
    value: "user",
    label: "User guide",
    description: "Plan, collaborate, and settle up",
    icon: BookOpen,
  },
  {
    value: "developer",
    label: "Developer docs",
    description: "Architecture, APIs, and operations",
    icon: Code2,
  },
] as const;

type Perspective = (typeof perspectives)[number]["value"];

export function PerspectiveSwitcher({
  perspective,
}: {
  perspective: Perspective;
}) {
  const router = useRouter();
  const active = perspectives.find((item) => item.value === perspective)!;
  const ActiveIcon = active.icon;

  function select(next: Perspective) {
    router.push(`/${next}`);
  }

  return (
    <Dialog.Root>
      <Dialog.Trigger className="perspective-trigger" type="button">
        <span className="perspective-trigger-icon" aria-hidden="true">
          <ActiveIcon size={16} strokeWidth={1.8} />
        </span>
        <span>{active.label}</span>
        <ChevronDown className="perspective-chevron" size={15} aria-hidden="true" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="perspective-backdrop" />
        <div className="perspective-viewport">
          <Dialog.Popup className="perspective-popup">
            <div className="perspective-heading">
              <div>
                <Dialog.Title>Choose a perspective</Dialog.Title>
                <Dialog.Description>
                  Switch between product help and implementation details.
                </Dialog.Description>
              </div>
              <Dialog.Close className="perspective-close" aria-label="Close">
                <X size={17} />
              </Dialog.Close>
            </div>
            <div className="perspective-options">
              {perspectives.map((item) => {
                const Icon = item.icon;
                const selected = item.value === perspective;
                return (
                  <Dialog.Close
                    key={item.value}
                    className="perspective-option"
                    data-selected={selected || undefined}
                    onClick={() => select(item.value)}
                    type="button"
                  >
                    <span className="perspective-option-icon" aria-hidden="true">
                      <Icon size={19} strokeWidth={1.75} />
                    </span>
                    <span className="perspective-option-copy">
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                    {selected ? <Check size={17} aria-hidden="true" /> : null}
                  </Dialog.Close>
                );
              })}
            </div>
          </Dialog.Popup>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
