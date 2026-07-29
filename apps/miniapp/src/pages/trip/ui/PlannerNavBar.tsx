import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useMemo } from "react";

import { copy } from "@/shared/copy";

import "./PlannerNavBar.scss";

interface PlannerNavBarProps {
  title: string;
  /** Present only when the deployment has the trip agent enabled (PWA parity). */
  onOpenAgent?: () => void;
}

interface NavMetrics {
  statusBarHeight: number;
  contentHeight: number;
  /** Right inset that keeps content clear of the WeChat menu capsule. */
  capsuleInset: number;
}

function readNavMetrics(): NavMetrics {
  try {
    const win = Taro.getWindowInfo
      ? Taro.getWindowInfo()
      : Taro.getSystemInfoSync();
    const menu = Taro.getMenuButtonBoundingClientRect();
    const statusBarHeight = win.statusBarHeight ?? 20;
    const gap = Math.max(menu.top - statusBarHeight, 0);
    return {
      statusBarHeight,
      contentHeight: menu.height + gap * 2,
      capsuleInset: win.windowWidth - menu.left + 8,
    };
  } catch {
    // Pre-2.27 clients without capsule metrics: sensible iPhone defaults.
    return { statusBarHeight: 20, contentHeight: 44, capsuleInset: 96 };
  }
}

/**
 * Custom WeChat navigation bar mirroring the PWA's MobilePlannerHeader: back +
 * title on the left, agent toggle on the right (left of the menu capsule).
 */
export function PlannerNavBar({ title, onOpenAgent }: PlannerNavBarProps) {
  const metrics = useMemo(readNavMetrics, []);

  function back(): void {
    if (Taro.getCurrentPages().length > 1) {
      void Taro.navigateBack();
    } else {
      // Shared links land here as the first page; "back" then means home.
      void Taro.switchTab({ url: "/pages/trips/index" });
    }
  }

  return (
    <>
      <View
        className="ot-planner-nav"
        style={{
          paddingTop: metrics.statusBarHeight,
          paddingRight: metrics.capsuleInset,
        }}
      >
        <View
          className="ot-planner-nav__row"
          style={{ height: metrics.contentHeight }}
        >
          <View
            className="ot-planner-nav__back"
            hoverClass="ot-planner-nav__back--pressed"
            hoverStartTime={0}
            hoverStayTime={80}
            onClick={back}
          >
            <Text className="ot-planner-nav__back-glyph">‹</Text>
          </View>
          <Text className="ot-planner-nav__title">{title}</Text>
          {onOpenAgent ? (
            <View
              className="ot-planner-nav__agent"
              hoverClass="ot-planner-nav__agent--pressed"
              hoverStartTime={0}
              hoverStayTime={80}
              onClick={onOpenAgent}
            >
              <Text className="ot-planner-nav__agent-text">{copy.trip.agent}</Text>
            </View>
          ) : null}
        </View>
      </View>
      {/* Spacer reserving the fixed bar's height in the page flow. */}
      <View
        style={{ height: metrics.statusBarHeight + metrics.contentHeight }}
      />
    </>
  );
}
