import { defineConfig, type UserConfigExport } from "@tarojs/cli";

import devConfig from "./dev";
import { readMiniappBuildEnv } from "./env";
import prodConfig from "./prod";

export default defineConfig<"webpack5">(async (merge) => {
  const { apiBaseUrl } = readMiniappBuildEnv();
  const baseConfig: UserConfigExport<"webpack5"> = {
    projectName: "opentrip",
    date: "2026-07-28",
    designWidth: 750,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      828: 1.81 / 2,
    },
    sourceRoot: "src",
    outputRoot: "dist",
    plugins: [],
    defineConstants: {
      OPENTRIP_API_BASE_URL: JSON.stringify(apiBaseUrl),
    },
    copy: { patterns: [], options: {} },
    framework: "react",
    compiler: "webpack5",
    alias: {
      "@": require("node:path").resolve(__dirname, "..", "src"),
    },
    mini: {
      postcss: {
        pxtransform: { enable: true, config: {} },
        cssModules: { enable: false, config: {} },
      },
    },
  };

  if (process.env.NODE_ENV === "development") {
    return merge({}, baseConfig, devConfig);
  }
  return merge({}, baseConfig, prodConfig);
});
