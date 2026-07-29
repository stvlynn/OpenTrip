import { Text, View } from "@tarojs/components";

import "./Tag.scss";

export type TagTone = "neutral" | "brand" | "success" | "warning" | "danger";

interface TagProps {
  label: string;
  tone?: TagTone;
  /** Overrides the tone with a per-day itinerary color. */
  color?: string;
}

export function Tag({ label, tone = "neutral", color }: TagProps) {
  return (
    <View
      className={`ot-tag ot-tag--${tone}`}
      // Arbitrary day colors keep the soft-tag system: 15% alpha tint on the
      // background (`26` hex suffix), full-strength color for the text.
      style={color ? { background: `${color}26`, color } : undefined}
    >
      <Text className="ot-tag__label">{label}</Text>
    </View>
  );
}
