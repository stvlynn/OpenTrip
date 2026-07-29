import type { UserConfigExport } from "@tarojs/cli";

export default {
  mini: {},
  logger: {
    quiet: false,
    stats: true,
  },
} satisfies UserConfigExport<"webpack5">;
