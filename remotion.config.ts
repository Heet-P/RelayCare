import path from "node:path";
import { Config } from "@remotion/cli/config";
import { enableTailwind } from "@remotion/tailwind-v4";

// The launch video renders the app's real components, so it shares Tailwind and the "@/" alias.
Config.setEntryPoint("remotion/index.ts");
Config.setPublicDir("remotion/public");
Config.overrideWebpackConfig((config) => {
  const withTw = enableTailwind(config);
  return {
    ...withTw,
    resolve: { ...withTw.resolve, alias: { ...withTw.resolve?.alias, "@": path.resolve(process.cwd()) } },
  };
});
