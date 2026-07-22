export type MapTheme = "light" | "dark";

const MAP_STYLE_URLS: Record<MapTheme, string> = {
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

export function mapStyleUrlForTheme(theme: MapTheme): string {
  return MAP_STYLE_URLS[theme];
}

export function routeCasingColorForTheme(theme: MapTheme): string {
  return theme === "dark" ? "#050505" : "#ffffff";
}
