import { Text, View } from "@tarojs/components";
import { useEffect, useState, type ReactNode } from "react";

import "./Sheet.scss";

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Extra bottom padding so the footer clears the native tab bar. */
  clearTabBar?: boolean;
}

/**
 * Bottom sheet used for every editing surface. The Mini Program keeps the
 * native navigation bar, so sheets stay inside the page rather than pushing a
 * new stack entry. The panel stays mounted while closing so the exit
 * transition can play; it unmounts once the transition has ended.
 */
export function Sheet({
  open,
  title,
  onClose,
  children,
  footer,
  clearTabBar = false,
}: SheetProps) {
  const [rendered, setRendered] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      setRendered(true);
      // Mount in the closed pose first, then flip to open a tick later so
      // the entrance transition actually runs.
      const enter = setTimeout(() => setShown(true), 30);
      return () => clearTimeout(enter);
    }
    setShown(false);
    // Unmount after the exit transition (~160ms) has finished.
    const exit = setTimeout(() => setRendered(false), 200);
    return () => clearTimeout(exit);
  }, [open]);

  if (!rendered) return null;
  return (
    <View className={shown ? "ot-sheet is-open" : "ot-sheet"}>
      <View className="ot-sheet__scrim" onClick={onClose} />
      <View
        className={
          clearTabBar
            ? "ot-sheet__panel ot-sheet__panel--clear-tab-bar"
            : "ot-sheet__panel"
        }
        catchMove
      >
        <View className="ot-sheet__header">
          <Text className="ot-sheet__title">{title}</Text>
        </View>
        <View className="ot-sheet__body">{children}</View>
        {footer ? <View className="ot-sheet__footer">{footer}</View> : null}
      </View>
    </View>
  );
}
