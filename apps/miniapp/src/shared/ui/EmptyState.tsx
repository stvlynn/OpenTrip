import { Text, View } from "@tarojs/components";
import type { ReactNode } from "react";

import "./EmptyState.scss";

interface EmptyStateProps {
  title: string;
  hint?: string;
  action?: ReactNode;
  /** Emoji rendered large above the title. */
  icon?: string;
}

export function EmptyState({ title, hint, action, icon }: EmptyStateProps) {
  return (
    <View className="ot-empty">
      {icon ? <Text className="ot-empty__icon">{icon}</Text> : null}
      <Text className="ot-empty__title">{title}</Text>
      {hint ? <Text className="ot-empty__hint">{hint}</Text> : null}
      {action ? <View className="ot-empty__action">{action}</View> : null}
    </View>
  );
}
