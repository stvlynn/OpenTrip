export default defineAppConfig({
  pages: [
    "pages/trips/index",
    "pages/today/index",
    "pages/journal/index",
    "pages/journal-entry/index",
    "pages/trip/index",
    "pages/invite/index",
    "pages/settings/index",
  ],
  window: {
    navigationBarTitleText: "OpenTrip",
    navigationBarBackgroundColor: "#fafbfd",
    navigationBarTextStyle: "black",
    backgroundColor: "#fafbfd",
    backgroundTextStyle: "dark",
  },
  tabBar: {
    position: "bottom",
    color: "#6d788f",
    selectedColor: "#28304a",
    backgroundColor: "#fafbfd",
    borderStyle: "white",
    // Keep tab labels in sync with shared/copy (this file is bundled separately
    // by Taro and cannot import it).
    list: [
      { pagePath: "pages/trips/index", text: "行程" },
      { pagePath: "pages/today/index", text: "今天" },
      { pagePath: "pages/journal/index", text: "游记" },
    ],
  },
  permission: {
    "scope.userLocation": {
      desc: "用于在地图上选择行程地点",
    },
  },
  // Only stop creation reaches for a location; the planner map never asks for
  // the device position, so `getLocation` is not requested.
  requiredPrivateInfos: ["chooseLocation"],
  lazyCodeLoading: "requiredComponents",
});
