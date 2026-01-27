export const SVG_NS = "http://www.w3.org/2000/svg";

export function svgEl<K extends keyof SVGElementTagNameMap>(
    tagName: K,
    attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
    const node = document.createElementNS(SVG_NS, tagName);

    for (const [key, value] of Object.entries(attrs)) {
        node.setAttribute(key, String(value));
    }

    return node;
}

export function setAttrs(
    node: Element,
    attrs: Record<string, string | number>,
): void {
    for (const [key, value] of Object.entries(attrs)) {
        node.setAttribute(key, String(value));
    }
}
