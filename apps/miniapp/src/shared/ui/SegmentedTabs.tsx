import { Text, View } from "@tarojs/components";

import "./SegmentedTabs.scss";

export interface SegmentedTab<T extends string> {
  value: T;
  label: string;
}

interface SegmentedTabsProps<T extends string> {
  tabs: readonly SegmentedTab<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
}: SegmentedTabsProps<T>) {
  return (
    <View className="ot-tabs">
      {tabs.map((tab) => (
        <View
          key={tab.value}
          className={
            tab.value === value ? "ot-tabs__item is-active" : "ot-tabs__item"
          }
          hoverClass="ot-tabs__item--pressed"
          onClick={() => onChange(tab.value)}
        >
          <Text className="ot-tabs__label">{tab.label}</Text>
        </View>
      ))}
    </View>
  );
}
