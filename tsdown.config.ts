import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["index.ts"],
  format: ["esm"],
  platform: "node",
  target: "esnext",
  fixedExtension: false,
  minify: true,
  clean: true,
  dts: {
    generator: "tsgo",
  },
});
