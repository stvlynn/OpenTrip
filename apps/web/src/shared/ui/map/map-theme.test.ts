import { describe, expect, it } from "vitest";
import {
  mapStyleUrlForTheme,
  routeCasingColorForTheme,
} from "./map-theme";

describe("map theme", () => {
  it("uses the matching CARTO vector style", () => {
    expect(mapStyleUrlForTheme("light")).toContain("positron");
    expect(mapStyleUrlForTheme("dark")).toContain("dark-matter");
  });

  it("keeps route casing legible on each basemap", () => {
    expect(routeCasingColorForTheme("light")).toBe("#ffffff");
    expect(routeCasingColorForTheme("dark")).toBe("#050505");
  });
});
