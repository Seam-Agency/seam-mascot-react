import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: "es2020",
  external: ["react", "react/jsx-runtime"],
  outExtension({ format }) {
    return { js: format === "esm" ? ".js" : ".cjs" };
  }
});
