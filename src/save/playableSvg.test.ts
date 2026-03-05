import { describe, expect, it } from "vitest";
import { SVG_STATE_METADATA_ID } from "./svgMetadata";
import { createPlayableSvgDocument } from "./playableSvg";

describe("playable SVG export", () => {
    it("creates a bootable SVG document with metadata, style, and script", () => {
        const svg = createPlayableSvgDocument({
            width: 1440,
            height: 810,
            metadata: JSON.stringify({
                world: { seed: 123, label: "<saved&safe>" },
            }),
            style: ".map-bg{fill:#fff}",
            script: "globalThis.__svgMetroBooted = true;",
        });

        expect(svg).toContain(`viewBox="0 0 1440 810"`);
        expect(svg).toContain(
            `<metadata id="${SVG_STATE_METADATA_ID}" type="application/json">`,
        );
        expect(svg).toContain("&lt;saved&amp;safe&gt;");
        expect(svg).toContain("<style><![CDATA[");
        expect(svg).toContain(".map-bg{fill:#fff}");
        expect(svg).toContain(
            '<script type="application/ecmascript"><![CDATA[',
        );
        expect(svg).toContain("globalThis.__svgMetroBooted = true;");
    });

    it("splits CDATA terminators in style and script content", () => {
        const svg = createPlayableSvgDocument({
            width: 10,
            height: 10,
            metadata: "{}",
            style: "a{content:']]>'}",
            script: "const x = ']]>';",
        });

        expect(svg).not.toContain("a{content:']]>'}");
        expect(svg).not.toContain("const x = ']]>';");
        expect(svg).toContain("]]]]><![CDATA[>");
    });
});
