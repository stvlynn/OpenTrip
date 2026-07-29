import { Text, View } from "@tarojs/components";
import type { ReactNode } from "react";

import "./SectionHeader.scss";

interface SectionHeaderProps {
  title: string;
  meta?: string;
  action?: ReactNode;
}

export function SectionHeader({ title, meta, action }: SectionHeaderProps) {
  return (
    <View className="ot-section-header">
      <View className="ot-section-header__text">
        <Text className="ot-section-header__title">{title}</Text>
        {meta ? <Text className="ot-section-header__meta">{meta}</Text> : null}
      </View>
      {action ? <View>{action}</View> : null}
    </View>
  );
}
