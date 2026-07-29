import { Text, View } from "@tarojs/components";
import type { ReactNode } from "react";

import { copy } from "@/shared/copy";

import { Button } from "./Button";
import "./Screen.scss";

interface ScreenProps {
  children?: ReactNode;
  /** Renders the shared loading and failure states instead of `children`. */
  status?: "loading" | "error" | "ready";
  errorTitle?: string;
  onRetry?: () => void;
  /** Reserves room above the tab bar for a floating action. */
  padded?: boolean;
  /** Adds extra bottom padding so content clears the native tab bar. */
  tab?: boolean;
}

export function Screen({
  children,
  status = "ready",
  errorTitle,
  onRetry,
  padded = true,
  tab = false,
}: ScreenProps) {
  if (status === "loading") {
    return (
      <View className="ot-screen ot-screen--center">
        <Text className="ot-screen__hint">{copy.app.loading}</Text>
      </View>
    );
  }

  if (status === "error") {
    return (
      <View className="ot-screen ot-screen--center">
        <Text className="ot-screen__title">{errorTitle ?? copy.app.loadFailed}</Text>
        {onRetry ? (
          <View className="ot-screen__action">
            <Button variant="secondary" size="sm" onClick={onRetry}>
              {copy.app.retry}
            </Button>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View
      className={[
        "ot-screen",
        padded ? "ot-screen--padded" : "",
        tab ? "ot-screen--tab" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </View>
  );
}
