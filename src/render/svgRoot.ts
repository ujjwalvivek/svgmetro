import { svgEl } from "./svgElements";
import type { WorldConfig } from "../sim/types";

export interface SvgLayers {
    background: SVGGElement;
    routes: SVGGElement;
    routePreview: SVGGElement;
    stations: SVGGElement;
    trains: SVGGElement;
    passengers: SVGGElement;
    effects: SVGGElement;
    debug?: SVGGElement;
}

export interface SvgRoot {
    svg: SVGSVGElement;
    layers: SvgLayers;
}

export function createSvgRoot(config: WorldConfig): SvgRoot {
    const svg = svgEl("svg", {
        id: "world",
        viewBox: `0 0 ${config.mapWidth} ${config.mapHeight}`,
        role: "img",
        "aria-label": "SVG Metro simulation",
    });

    const background = layer("background");
    const routes = layer("routes");
    const routePreview = layer("route-preview");
    const stations = layer("stations");
    const trains = layer("trains");
    const passengers = layer("passengers");
    const effects = layer("effects");
    const debug = layer("debug");

    const bgRect = svgEl("rect", {
        x: 0,
        y: 0,
        width: config.mapWidth,
        height: config.mapHeight,
        class: "map-bg",
    });
    background.append(bgRect, ...createBackgroundLines());

    svg.append(
        background,
        routes,
        routePreview,
        stations,
        trains,
        passengers,
        effects,
        debug,
    );

    return {
        svg,
        layers: {
            background,
            routes,
            routePreview,
            stations,
            trains,
            passengers,
            effects,
            debug,
        },
    };
}

function createBackgroundLines(): SVGPathElement[] {
    return [
        svgEl("path", {
            class: "bg-route bg-route-a",
            d: "M80 640 L240 520 L390 560 L570 430 L740 455 L900 300 L1120 250",
        }),
        svgEl("path", {
            class: "bg-route bg-route-b",
            d: "M160 170 L320 260 L520 220 L710 310 L950 170 L1130 185",
        }),
        svgEl("path", {
            class: "bg-route bg-route-c",
            d: "M250 735 L375 610 L505 625 L650 535 L830 620 L1030 560",
        }),
    ];
}

function layer(id: string): SVGGElement {
    return svgEl("g", { id });
}
