import esbuild from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

const watch = process.argv.includes("--watch");

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await cp("public", "dist", { recursive: true });

const shared = {
  bundle: true,
  target: "chrome120",
  legalComments: "none",
  logLevel: "info",
  sourcemap: watch ? "inline" : false,
  minify: !watch,
};

const targets = [
  { entry: "src/background/service-worker.ts", out: "dist/background.js", format: "esm" },
  { entry: "src/content/content.ts", out: "dist/content.js", format: "iife" },
  { entry: "src/popup/popup.ts", out: "dist/popup.js", format: "esm" },
  { entry: "src/options/options.ts", out: "dist/options.js", format: "esm" },
];

if (watch) {
  const contexts = await Promise.all(
    targets.map((t) =>
      esbuild.context({
        ...shared,
        entryPoints: [t.entry],
        outfile: t.out,
        format: t.format,
      }),
    ),
  );
  await Promise.all(contexts.map((c) => c.watch()));
  console.log("\nsitekey: watching for changes…");
} else {
  await Promise.all(
    targets.map((t) =>
      esbuild.build({
        ...shared,
        entryPoints: [t.entry],
        outfile: t.out,
        format: t.format,
      }),
    ),
  );
  console.log("\nsitekey: build complete → dist/");
}
