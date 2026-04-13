import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { build } from "vite";
import { transform } from "esbuild";

const root = path.dirname(fileURLToPath(import.meta.url));
const tmpDir = path.join(root, ".tmp");
const distDir = path.join(root, "dist");
const publicDir = path.join(root, "public");
const seed = 0x5eed1234;
const bootMetadata = JSON.stringify({ version: 1, seed });
const mapWidth = 1440;
const mapHeight = 810;

await rm(tmpDir, { recursive: true, force: true });
await rm(distDir, { recursive: true, force: true });

const [leanRuntimeSource, perfRuntimeSource] = await Promise.all([
    buildRuntime(false),
    buildRuntime(true),
]);

const [styleSource, fontSource] = await Promise.all([
    readFile(path.join(root, "src", "standalone", "minimetro.css"), "utf8"),
    readFile(path.join(root, "public", "svg-metro.woff2")),
]);
const [leanStyleResult, perfStyleResult] = await Promise.all([
    transform(stripLeanOnlyCss(styleSource), { loader: "css", minify: true }),
    transform(styleSource, { loader: "css", minify: true }),
]);
const fontBase64 = fontSource.toString("base64");
const leanSvg = createSvg(leanStyleResult.code, leanRuntimeSource, fontBase64);
const perfSvg = createSvg(perfStyleResult.code, perfRuntimeSource, fontBase64);

await mkdir(distDir, { recursive: true });
await mkdir(publicDir, { recursive: true });
await Promise.all([
    writeFile(path.join(distDir, "minimetro.svg"), leanSvg),
    writeFile(path.join(publicDir, "minimetro.svg"), leanSvg),
    writeFile(path.join(publicDir, "minimetro.perf.svg"), perfSvg),
]);
await rm(tmpDir, { recursive: true, force: true });

const leanSize = measure(leanSvg);
const perfSize = measure(perfSvg);
const rawDiff = perfSize.bytes - leanSize.bytes;
const gzipDiff = perfSize.gzipBytes - leanSize.gzipBytes;
console.log(`built dist/minimetro.svg          lean  ${formatSize(leanSize.bytes)} (${formatSize(leanSize.gzipBytes)} gzip)`);
console.log(`built public/minimetro.svg        lean  ${formatSize(leanSize.bytes)} (${formatSize(leanSize.gzipBytes)} gzip)`);
console.log(`built public/minimetro.perf.svg   perf  ${formatSize(perfSize.bytes)} (${formatSize(perfSize.gzipBytes)} gzip)`);
console.log(`perf overhead: +${formatSize(rawDiff)} raw, +${formatSize(gzipDiff)} gzip`);

async function buildRuntime(perf) {
    const runtimeOutDir = path.join(tmpDir, perf ? "svg-runtime-perf" : "svg-runtime-lean");
    const runtimeFile = path.join(runtimeOutDir, "runtime.js");

    await build({
        configFile: false,
        publicDir: false,
        logLevel: "warn",
        define: {
            __SVG_METRO_PERF__: String(perf),
        },
        build: {
            emptyOutDir: true,
            minify: "esbuild",
            outDir: runtimeOutDir,
            sourcemap: false,
            lib: {
                entry: path.join(root, "src", "standalone", "runtime.ts"),
                formats: ["iife"],
                name: "MiniMetroSvg",
            },
            rollupOptions: {
                output: {
                    entryFileNames: "runtime.js",
                },
            },
        },
    });

    return readFile(runtimeFile, "utf8");
}

function stripLeanOnlyCss(style) {
    return style
        .replace(
            /\.screen-overlay,\n\.options-panel \{/g,
            ".screen-overlay {",
        )
        .replace(
            /\.screen-overlay\.is-visible,\n\.options-panel\.is-visible \{/g,
            ".screen-overlay.is-visible {",
        )
        .replace(
            /\.screen-card > rect,\n\.options-panel > rect \{/g,
            ".screen-card > rect {",
        )
        .replace(/\n\.debug-panel \{[^}]*\}/g, "")
        .replace(/\n\.debug-title \{[^}]*\}/g, "")
        .replace(/\n\.debug-text \{[^}]*\}/g, "")
        .replace(/\n\.options-title \{[^}]*\}/g, "")
        .replace(/\n\.options-label \{[^}]*\}/g, "")
        .replace(/\n\.volume-slider \{[^}]*\}/g, "")
        .replace(/\n\.volume-slider-hit \{[^}]*\}/g, "")
        .replace(/\n\.volume-slider-track \{[^}]*\}/g, "")
        .replace(/\n\.volume-slider-fill \{[^}]*\}/g, "")
        .replace(/\n\.volume-slider-knob \{[^}]*\}/g, "");
}

function measure(value) {
    return {
        bytes: Buffer.byteLength(value, "utf8"),
        gzipBytes: gzipSync(value).byteLength,
    };
}

function formatSize(bytes) {
    return `${(bytes / 1024).toFixed(1)} KB`;
}

function createSvg(style, runtime, fontBase64) {
    return `<?xml version="1.0" encoding="UTF-8"?><svg id="world" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${mapWidth} ${mapHeight}" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" role="application" aria-label="SVG Metro"><metadata id="svg-metro-state" type="application/json">${bootMetadata}</metadata><style><![CDATA[@font-face{font-family:svg-metro;src:url(data:font/woff2;base64,${fontBase64}) format("woff2");font-weight:400;font-style:normal;font-display:block}${style}]]></style><rect x="0" y="0" width="${mapWidth}" height="${mapHeight}" class="map-bg"/><g id="boot" font-family="svg-metro"><text x="24" y="42" fill="#443635" font-size="9">SVG Metro booting from minimetro.svg</text><text x="24" y="56" fill="rgba(68,54,53,.58)" font-size="7">If this text remains, script execution is blocked.</text></g><script type="application/ecmascript"><![CDATA[${runtime.replaceAll("]]>", "]]]]><![CDATA[>")}]]></script></svg>`;
}
