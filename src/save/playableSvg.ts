import { SVG_STATE_METADATA_ID } from "./svgMetadata";

export interface PlayableSvgDocumentInput {
    width: number;
    height: number;
    metadata: string;
    style: string;
    script: string;
    bootMessage?: string;
}

export function createPlayableSvgDocument(
    input: PlayableSvgDocumentInput,
): string {
    const bootMessage = input.bootMessage ?? "SVG Metro loading saved game";

    return `<?xml version="1.0" encoding="UTF-8"?><svg id="world" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${input.width} ${input.height}" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" role="application" aria-label="SVG Metro"><metadata id="${SVG_STATE_METADATA_ID}" type="application/json">${escapeXmlText(input.metadata)}</metadata><style><![CDATA[${escapeCdata(input.style)}]]></style><rect x="0" y="0" width="${input.width}" height="${input.height}" class="map-bg"/><g id="boot" font-family="svg-metro"><text x="24" y="42" fill="#443635" font-size="9">${escapeXmlText(bootMessage)}</text><text x="24" y="56" fill="rgba(68,54,53,.58)" font-size="7">If this text remains, script execution is blocked.</text></g><script type="application/ecmascript"><![CDATA[${escapeCdata(input.script)}]]></script></svg>`;
}

function escapeXmlText(text: string): string {
    return text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
}

function escapeCdata(text: string): string {
    return text.replaceAll("]]>", "]]]]><![CDATA[>");
}
