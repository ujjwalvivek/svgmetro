import { createMetroAudio } from "../audio/metroAudio";
import { applyDebugAction } from "../debug/actions";
import { createFrameStats, updateFrameStats } from "../debug/stats";
import { findRouteId, findStationId } from "../input/hitTest";
import {
    applyRouteCommand,
    createRouteEditor,
    ROUTE_COLORS,
    type GameCommand,
} from "../input/routeEditor";
import { createSvgCache, renderWorld } from "../render/renderWorld";
import { svgEl } from "../render/svgElements";
import type { SvgLayers, SvgRoot } from "../render/svgRoot";
import {
    stationFitViewBox,
    viewBoxScale,
    viewBoxToString,
    type SvgViewBox,
} from "../render/viewBox";
import {
    loadWorldFromMetadataText,
    SVG_STATE_METADATA_ID,
} from "../save/svgMetadata";
import { createPlayableSvgDocument } from "../save/playableSvg";
import { encodeWorld } from "../save/worldState";
import { createRng, rand, randRange } from "../sim/rng";
import { FIXED_DT, tick } from "../sim/tick";
import type { World, WorldConfig } from "../sim/types";
import { createWorld } from "../sim/world";

declare const __SVG_METRO_PERF__: boolean;

const SVG_ACTION_ATTR = "data-svg-action";
const PERF_BUILD =
    typeof __SVG_METRO_PERF__ === "boolean" ? __SVG_METRO_PERF__ : true;
const NODE_COUNT_SAMPLE_MS = 500;
const LINE_PALETTE_WIDTH = 214;
const VOLUME_SLIDER_WIDTH = 92;
type ScreenMode = "start" | "playing";

const initialMetadata = document
    .querySelector<SVGMetadataElement>(`metadata#${SVG_STATE_METADATA_ID}`)
    ?.textContent?.trim();
let world = loadInitialWorld(initialMetadata);
let routeEditor = createRouteEditor();
let selectedStationId: number | undefined;
let accumulator = 0;
let last = performance.now();
let mode: ScreenMode = isSavedWorldMetadata(initialMetadata)
    ? "playing"
    : "start";
let debugVisible = false;
let optionsOpen = false;
let currentViewBox: SvgViewBox = stationFitViewBox(world);
let framedStationCount = -1;
let audioSnapshot = captureAudioState(world);
let volumeDrag = false;

const svgRoot = createStandaloneSvgRoot(
    document.documentElement as unknown as SVGSVGElement,
    world.config,
    world.seed,
);
let cache = createSvgCache();
const audio = createMetroAudio();
const stats = createFrameStats();
let lastNodeCountSample = 0;
const hud = createHud();
const linePalette = createLinePalette();
const startOverlay = createStartOverlay();
const optionsPanel = createOptionsPanel();
const gameOverOverlay = createGameOverOverlay();

svgRoot.svg.append(
    hud,
    linePalette,
    startOverlay,
    optionsPanel,
    gameOverOverlay,
);
const ui = createUiRefs();
syncViewBox(true);
wireInput();
render();
requestAnimationFrame(frame);

function loadInitialWorld(metadataText: string | undefined): World {
    if (isSavedWorldMetadata(metadataText))
        return loadWorldFromMetadataText(metadataText);
    return createAttractWorld(metadataText);
}

function isSavedWorldMetadata(metadataText: string | undefined): boolean {
    if (!metadataText) return false;

    try {
        const data = JSON.parse(metadataText) as { world?: unknown };
        return data.world !== undefined;
    } catch {
        return false;
    }
}

function createAttractWorld(metadataText: string | undefined): World {
    const demo = loadWorldFromMetadataText(metadataText);
    const editor = createRouteEditor();
    const stations = [...demo.stations.values()];
    const byX = [...stations].sort((a, b) => a.x - b.x);
    const byY = [...stations].sort((a, b) => a.y - b.y);
    const diagonal = [...stations].sort((a, b) => a.x + a.y - (b.x + b.y));
    const counter = [...stations].sort((a, b) => a.x - a.y - (b.x - b.y));

    for (const ids of [byX, byY, diagonal, counter].map((line) =>
        line.slice(1, 6).map((station) => station.id),
    )) {
        for (const stationId of ids) {
            applyRouteCommand(demo, editor, {
                type: "append-station",
                stationId,
            });
        }
        applyRouteCommand(demo, editor, { type: "commit-route" });
    }

    return demo;
}

function createStandaloneSvgRoot(
    svg: SVGSVGElement,
    config: WorldConfig,
    seed: number,
): SvgRoot {
    svg.setAttribute("id", "world");
    svg.setAttribute("viewBox", `0 0 ${config.mapWidth} ${config.mapHeight}`);
    svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
    svg.setAttribute("role", "application");
    svg.setAttribute("aria-label", "SVG Metro");

    for (const id of [
        "background",
        "routes",
        "route-preview",
        "stations",
        "trains",
        "passengers",
        "effects",
        "debug",
        "svg-hud",
        "line-palette",
        "start-screen",
        "options-panel",
        "game-over",
    ]) {
        svg.querySelector(`#${id}`)?.remove();
    }

    const background = layer("background");
    const routes = layer("routes");
    const routePreview = layer("route-preview");
    const stations = layer("stations");
    const trains = layer("trains");
    const passengers = layer("passengers");
    const effects = layer("effects");
    const debug = layer("debug");

    renderBackground(background, config, seed);
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

    const layers: SvgLayers = {
        background,
        routes,
        routePreview,
        stations,
        trains,
        passengers,
        effects,
        debug,
    };

    return { svg, layers };
}

function renderBackground(
    background: SVGGElement,
    config: WorldConfig,
    seed: number,
): void {
    const bgRect = svgEl("rect", {
        x: 0,
        y: 0,
        width: config.mapWidth,
        height: config.mapHeight,
        class: "map-bg",
    });

    background.replaceChildren(
        bgRect,
        createCityLayout(config, seed),
        ...createBackgroundLines(),
    );
}

function createBackgroundLines(): SVGPathElement[] {
    return [];
}

function createCityLayout(config: WorldConfig, seed: number): SVGGElement {
    const group = svgEl("g", { class: "city-layout" });
    const rng = createRng(seed ^ 0xa63d2f1);

    group.append(
        svgEl("rect", {
            class: "paper-grain",
            x: 0,
            y: 0,
            width: config.mapWidth,
            height: config.mapHeight,
        }),
    );

    for (let index = 0; index < 7; index += 1) {
        group.append(
            svgEl("path", {
                class: `map-region map-region-${index % 4}`,
                d: blobPath(
                    randRange(rng, 80, config.mapWidth - 80),
                    randRange(rng, 80, config.mapHeight - 80),
                    randRange(rng, 120, 300),
                    randRange(rng, 90, 220),
                    rng,
                ),
            }),
        );
    }

    const gridX = 56 + randRange(rng, -6, 6);
    const gridY = 48 + randRange(rng, -5, 5);
    for (
        let x = randRange(rng, -30, 30);
        x < config.mapWidth + gridX;
        x += gridX
    ) {
        group.append(
            svgEl("path", {
                class: "map-grid-line",
                d: `M${x.toFixed(1)} 0 L${x.toFixed(1)} ${config.mapHeight}`,
            }),
        );
    }
    for (
        let y = randRange(rng, -24, 24);
        y < config.mapHeight + gridY;
        y += gridY
    ) {
        group.append(
            svgEl("path", {
                class: "map-grid-line",
                d: `M0 ${y.toFixed(1)} L${config.mapWidth} ${y.toFixed(1)}`,
            }),
        );
    }

    const river = waterPath(config, rng);
    group.append(
        svgEl("path", { class: "water-edge", d: river }),
        svgEl("path", { class: "water-line", d: river }),
    );

    for (let index = 0; index < 150; index += 1) {
        const x = randRange(rng, 28, config.mapWidth - 72);
        const y = randRange(rng, 34, config.mapHeight - 70);
        const width = randRange(rng, 22, 78);
        const height = randRange(rng, 14, 54);
        group.append(
            svgEl("rect", {
                class: `city-block city-block-${index % 4}`,
                x,
                y,
                width,
                height,
            }),
        );
    }

    for (let index = 0; index < 84; index += 1) {
        group.append(
            svgEl("circle", {
                class: "paper-speck",
                cx: randRange(rng, 0, config.mapWidth),
                cy: randRange(rng, 0, config.mapHeight),
                r: randRange(rng, 0.6, 1.8),
            }),
        );
    }

    return group;
}

function blobPath(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    rng: ReturnType<typeof createRng>,
): string {
    const points = Array.from({ length: 7 }, (_, index) => {
        const angle = (Math.PI * 2 * index) / 7 + randRange(rng, -0.22, 0.22);
        const radius = randRange(rng, 0.68, 1.12);
        return {
            x: cx + Math.cos(angle) * rx * radius,
            y: cy + Math.sin(angle) * ry * radius,
        };
    });
    return `${points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ")} Z`;
}

function waterPath(
    config: WorldConfig,
    rng: ReturnType<typeof createRng>,
): string {
    const horizontal = rand(rng) > 0.5;

    if (horizontal) {
        const y = randRange(
            rng,
            config.mapHeight * 0.34,
            config.mapHeight * 0.68,
        );
        return `M-80 ${y.toFixed(1)} C${randRange(rng, 150, 280).toFixed(1)} ${(y + randRange(rng, -120, 120)).toFixed(1)} ${randRange(rng, 430, 620).toFixed(1)} ${(y + randRange(rng, -120, 120)).toFixed(1)} ${randRange(rng, 680, 820).toFixed(1)} ${(y + randRange(rng, -80, 80)).toFixed(1)} S${randRange(rng, 1030, 1190).toFixed(1)} ${(y + randRange(rng, -120, 120)).toFixed(1)} ${config.mapWidth + 80} ${(y + randRange(rng, -80, 80)).toFixed(1)}`;
    }

    const x = randRange(rng, config.mapWidth * 0.32, config.mapWidth * 0.72);
    return `M${x.toFixed(1)} -80 C${(x + randRange(rng, -180, 180)).toFixed(1)} ${randRange(rng, 120, 240).toFixed(1)} ${(x + randRange(rng, -180, 180)).toFixed(1)} ${randRange(rng, 340, 480).toFixed(1)} ${(x + randRange(rng, -90, 90)).toFixed(1)} ${randRange(rng, 520, 620).toFixed(1)} S${(x + randRange(rng, -170, 170)).toFixed(1)} ${randRange(rng, 680, 760).toFixed(1)} ${(x + randRange(rng, -90, 90)).toFixed(1)} ${config.mapHeight + 80}`;
}

function layer(id: string): SVGGElement {
    return svgEl("g", { id });
}

function createHud(): SVGGElement {
    const group = svgEl("g", {
        id: "svg-hud",
        transform: "translate(22 18)",
    });
    const panel = svgEl("rect", {
        class: "svg-hud-panel",
        width: 340,
        height: 84,
    });
    const title = svgEl("text", {
        class: "svg-hud-title",
        x: 16,
        y: 25,
    });
    const status = svgEl("text", {
        id: "svg-hud-status",
        class: "svg-hud-status",
        x: 252,
        y: 25,
    });
    const scoreLabel = svgEl("text", {
        class: "hud-label",
        x: 16,
        y: 45,
    });
    const score = svgEl("text", {
        id: "hud-score",
        class: "hud-value",
        x: 16,
        y: 63,
    });
    const linesLabel = svgEl("text", {
        class: "hud-label",
        x: 74,
        y: 45,
    });
    const lines = svgEl("text", {
        id: "hud-lines",
        class: "hud-value",
        x: 74,
        y: 63,
    });
    const waitingLabel = svgEl("text", {
        class: "hud-label",
        x: 132,
        y: 45,
    });
    const waitingCount = svgEl("text", {
        id: "hud-waiting",
        class: "hud-value hud-warn",
        x: 132,
        y: 63,
    });
    const ridingLabel = svgEl("text", {
        class: "hud-label",
        x: 206,
        y: 45,
    });
    const ridingCount = svgEl("text", {
        id: "hud-riding",
        class: "hud-value",
        x: 206,
        y: 63,
    });
    const statsText = svgEl("text", {
        id: "svg-hud-stats",
        class: "svg-hud-stats",
        x: 16,
        y: 80,
    });
    const meta = svgEl("text", {
        id: "svg-hud-meta",
        class: "svg-hud-meta hud-meta-visible",
        x: 16,
        y: 80,
    });

    title.textContent = "SVG METRO";
    status.textContent = "BOOTING";
    scoreLabel.textContent = "SCORE";
    linesLabel.textContent = "LINES";
    waitingLabel.textContent = "WAITING";
    ridingLabel.textContent = "RIDING";

    group.append(
        panel,
        title,
        status,
        scoreLabel,
        score,
        linesLabel,
        lines,
        waitingLabel,
        waitingCount,
        ridingLabel,
        ridingCount,
        statsText,
        meta,
        createButton("save", 276, 9, "save-game", 50, 17),
        createButton("opts", 276, 29, "toggle-options", 50, 17),
    );
    return group;
}

function createLinePalette(): SVGGElement {
    const group = svgEl("g", {
        id: "line-palette",
        class: "line-palette",
        transform: `translate(${world.config.mapWidth / 2 - LINE_PALETTE_WIDTH / 2} ${world.config.mapHeight - 48})`,
    });
    const panel = svgEl("rect", {
        class: "line-palette-panel",
        width: LINE_PALETTE_WIDTH,
        height: 28,
    });

    group.append(panel);

    ROUTE_COLORS.forEach((color, index) => {
        const swatch = svgEl("circle", {
            class: "line-swatch",
            "data-color-index": index,
            cx: 24 + index * 28,
            cy: 14,
            r: 9,
            fill: color,
        });
        group.append(swatch);
    });

    return group;
}

function createStartOverlay(): SVGGElement {
    const group = svgEl("g", {
        id: "start-screen",
        class: "screen-overlay start-screen",
    });
    const scrim = svgEl("rect", {
        class: "screen-scrim",
        x: 0,
        y: 0,
        width: world.config.mapWidth,
        height: world.config.mapHeight,
    });
    const card = svgEl("g", {
        class: "screen-card",
        transform: `translate(${world.config.mapWidth / 2} ${world.config.mapHeight / 2})`,
    });
    const panel = svgEl("rect", {
        x: -244,
        y: -106,
        width: 488,
        height: 212,
    });
    const title = svgEl("text", {
        class: "screen-title",
        y: -44,
        "text-anchor": "middle",
    });
    const subtitle = svgEl("text", {
        class: "screen-subtitle",
        y: -12,
        "text-anchor": "middle",
    });
    const note = svgEl("text", {
        class: "screen-note",
        y: 64,
        "text-anchor": "middle",
    });

    title.textContent = "SVG METRO";
    subtitle.textContent =
        "A playable transit sim contained inside one SVG file";
    note.textContent =
        "Click stations to draw a line. Enter commits. R removes active.";
    card.append(
        panel,
        title,
        subtitle,
        createButton("start", -60, 20, "start-game", 120, 26),
        note,
    );
    group.append(scrim, card);
    return group;
}

function createOptionsPanel(): SVGGElement {
    const group = svgEl("g", {
        id: "options-panel",
        class: "options-panel",
        transform: "translate(370 18)",
    });
    const panel = svgEl("rect", {
        width: PERF_BUILD ? 276 : 214,
        height: PERF_BUILD ? 210 : 116,
    });
    const title = svgEl("text", {
        class: "options-title",
        x: 14,
        y: 22,
    });
    const debugLabel = svgEl("text", {
        id: "debug-toggle-label",
        class: "options-label",
        x: 14,
        y: 52,
    });
    const audioLabel = svgEl("text", {
        id: "audio-toggle-label",
        class: "options-label",
        x: 14,
        y: PERF_BUILD ? 78 : 52,
    });
    const volumeLabel = svgEl("text", {
        id: "volume-label",
        class: "options-label",
        x: 14,
        y: PERF_BUILD ? 104 : 78,
    });
    const volumeSlider = createVolumeSlider(96, PERF_BUILD ? 100 : 74);
    const perfLabel = svgEl("text", {
        class: "options-title",
        x: 14,
        y: 132,
    });

    title.textContent = "OPTIONS";
    debugLabel.textContent = "Debug overlay off";
    audioLabel.textContent = "Sound on";
    volumeLabel.textContent = "Volume 100";
    perfLabel.textContent = "PERF";
    const nodes: SVGElement[] = [
        panel,
        title,
        audioLabel,
        volumeLabel,
        volumeSlider,
        createButton(
            "sound",
            PERF_BUILD ? 196 : 136,
            PERF_BUILD ? 61 : 35,
            "toggle-audio",
            60,
            20,
        ),
        createButton(
            "close",
            PERF_BUILD ? 196 : 136,
            87,
            "toggle-options",
            60,
            20,
        ),
    ];

    if (PERF_BUILD) {
        nodes.push(
            debugLabel,
            perfLabel,
            createButton("debug", 196, 35, "toggle-debug", 60, 20),
            createButton("geom off", 14, 142, "toggle-svg-geometry", 68, 20),
            createButton("dirty on", 88, 142, "toggle-dirty-rendering", 72, 20),
            createButton(
                "allpax off",
                166,
                142,
                "toggle-render-all-passengers",
                84,
                20,
            ),
            createButton("pax", 14, 168, "stress-passengers", 50, 20),
            createButton("stations", 70, 168, "stress-stations", 74, 20),
            createButton("routes", 150, 168, "stress-routes", 62, 20),
            createButton("stress", 218, 168, "stress-test", 50, 20),
        );
    }

    group.append(...nodes);
    return group;
}

function createVolumeSlider(x: number, y: number): SVGGElement {
    const group = svgEl("g", {
        id: "volume-slider",
        class: "volume-slider",
        transform: `translate(${x} ${y})`,
        [SVG_ACTION_ATTR]: "volume-slider",
    });
    const hit = svgEl("rect", {
        class: "volume-slider-hit",
        x: -4,
        y: -8,
        width: VOLUME_SLIDER_WIDTH + 8,
        height: 18,
        [SVG_ACTION_ATTR]: "volume-slider",
    });
    const track = svgEl("rect", {
        class: "volume-slider-track",
        y: -1,
        width: VOLUME_SLIDER_WIDTH,
        height: 2,
        [SVG_ACTION_ATTR]: "volume-slider",
    });
    const fill = svgEl("rect", {
        id: "volume-slider-fill",
        class: "volume-slider-fill",
        y: -1,
        width: VOLUME_SLIDER_WIDTH,
        height: 2,
        [SVG_ACTION_ATTR]: "volume-slider",
    });
    const knob = svgEl("rect", {
        id: "volume-slider-knob",
        class: "volume-slider-knob",
        x: VOLUME_SLIDER_WIDTH - 4,
        y: -6,
        width: 8,
        height: 10,
        [SVG_ACTION_ATTR]: "volume-slider",
    });

    group.append(hit, track, fill, knob);
    return group;
}

function createGameOverOverlay(): SVGGElement {
    const group = svgEl("g", {
        id: "game-over",
        class: "screen-overlay game-over-overlay",
    });
    const scrim = svgEl("rect", {
        class: "screen-scrim",
        x: 0,
        y: 0,
        width: world.config.mapWidth,
        height: world.config.mapHeight,
    });
    const card = svgEl("g", {
        class: "screen-card",
        transform: `translate(${world.config.mapWidth / 2} ${world.config.mapHeight / 2})`,
    });
    const panel = svgEl("rect", {
        x: -244,
        y: -88,
        width: 488,
        height: 176,
    });
    const title = svgEl("text", {
        class: "game-over-title",
        y: -32,
        "text-anchor": "middle",
    });
    const body = svgEl("text", {
        class: "game-over-body",
        y: 3,
        "text-anchor": "middle",
    });

    title.textContent = "NETWORK OVERLOADED";
    body.textContent = "Press N to restart. Trains keep moving for inspection.";
    card.append(
        panel,
        title,
        body,
        createButton("restart", -68, 32, "restart-game", 136, 26),
    );
    group.append(scrim, card);
    return group;
}

function createButton(
    label: string,
    x: number,
    y: number,
    action: string,
    width = 62,
    height = 24,
): SVGGElement {
    const group = svgEl("g", {
        class: "svg-button",
        transform: `translate(${x} ${y})`,
        [SVG_ACTION_ATTR]: action,
    });
    const rect = svgEl("rect", {
        width,
        height,
        [SVG_ACTION_ATTR]: action,
    });
    const text = svgEl("text", {
        x: width / 2,
        y: height / 2 + 4,
        "text-anchor": "middle",
        [SVG_ACTION_ATTR]: action,
    });

    text.textContent = label;
    group.append(rect, text);
    return group;
}

interface UiRefs {
    status: SVGTextElement | null;
    meta: SVGTextElement | null;
    score: SVGTextElement | null;
    lines: SVGTextElement | null;
    waiting: SVGTextElement | null;
    riding: SVGTextElement | null;
    gameOver: SVGGElement | null;
    start: SVGGElement | null;
    options: SVGGElement | null;
    debugLabel: SVGTextElement | null;
    audioLabel: SVGTextElement | null;
    volumeLabel: SVGTextElement | null;
    volumeSlider: SVGGElement | null;
    volumeFill: SVGRectElement | null;
    volumeKnob: SVGRectElement | null;
    svgGeometryButton: SVGTextElement | null;
    renderAllButton: SVGTextElement | null;
    dirtyButton: SVGTextElement | null;
    swatches: SVGCircleElement[];
}

function createUiRefs(): UiRefs {
    return {
        status: svgRoot.svg.querySelector<SVGTextElement>("#svg-hud-status"),
        meta: svgRoot.svg.querySelector<SVGTextElement>("#svg-hud-meta"),
        score: svgRoot.svg.querySelector<SVGTextElement>("#hud-score"),
        lines: svgRoot.svg.querySelector<SVGTextElement>("#hud-lines"),
        waiting: svgRoot.svg.querySelector<SVGTextElement>("#hud-waiting"),
        riding: svgRoot.svg.querySelector<SVGTextElement>("#hud-riding"),
        gameOver: svgRoot.svg.querySelector<SVGGElement>("#game-over"),
        start: svgRoot.svg.querySelector<SVGGElement>("#start-screen"),
        options: svgRoot.svg.querySelector<SVGGElement>("#options-panel"),
        debugLabel: svgRoot.svg.querySelector<SVGTextElement>(
            "#debug-toggle-label",
        ),
        audioLabel: svgRoot.svg.querySelector<SVGTextElement>(
            "#audio-toggle-label",
        ),
        volumeLabel: svgRoot.svg.querySelector<SVGTextElement>("#volume-label"),
        volumeSlider: svgRoot.svg.querySelector<SVGGElement>("#volume-slider"),
        volumeFill: svgRoot.svg.querySelector<SVGRectElement>(
            "#volume-slider-fill",
        ),
        volumeKnob: svgRoot.svg.querySelector<SVGRectElement>(
            "#volume-slider-knob",
        ),
        svgGeometryButton: svgRoot.svg.querySelector<SVGTextElement>(
            `g[${SVG_ACTION_ATTR}="toggle-svg-geometry"] text`,
        ),
        renderAllButton: svgRoot.svg.querySelector<SVGTextElement>(
            `g[${SVG_ACTION_ATTR}="toggle-render-all-passengers"] text`,
        ),
        dirtyButton: svgRoot.svg.querySelector<SVGTextElement>(
            `g[${SVG_ACTION_ATTR}="toggle-dirty-rendering"] text`,
        ),
        swatches: [
            ...svgRoot.svg.querySelectorAll<SVGCircleElement>(".line-swatch"),
        ],
    };
}

function wireInput(): void {
    svgRoot.svg.addEventListener("pointermove", (event) => {
        if (volumeDrag) {
            event.preventDefault();
            updateVolumeFromPointer(event);
            return;
        }

        if (mode !== "playing" || world.gameOver) {
            setEditorPreview(undefined, undefined, undefined);
            return;
        }

        const target = event.target instanceof Element ? event.target : null;
        const actionNode = target?.closest(`[${SVG_ACTION_ATTR}]`);
        if (actionNode) {
            setEditorPreview(undefined, undefined, undefined);
            return;
        }

        const stationId = findStationId(target);
        const isDuplicateDraftStation =
            stationId !== undefined &&
            routeEditor.draftStationIds.includes(stationId);
        if (stationId !== undefined) {
            setEditorPreview(
                isDuplicateDraftStation ? undefined : stationId,
                isDuplicateDraftStation ? stationId : undefined,
                undefined,
            );
            return;
        }

        const routeId = findRouteId(target);
        setEditorPreview(undefined, undefined, routeId);
    });

    svgRoot.svg.addEventListener("pointerleave", () => {
        setEditorPreview(undefined, undefined, undefined);
    });

    svgRoot.svg.addEventListener("pointerdown", (event) => {
        audio.unlock();
        const target = event.target instanceof Element ? event.target : null;
        const actionNode = target?.closest(`[${SVG_ACTION_ATTR}]`);
        const action = actionNode?.getAttribute(SVG_ACTION_ATTR);

        if (action === "volume-slider") {
            event.preventDefault();
            audio.unlock();
            volumeDrag = true;
            svgRoot.svg.setPointerCapture(event.pointerId);
            updateVolumeFromPointer(event);
            audio.cue("ui");
            render();
            return;
        }

        if (
            PERF_BUILD &&
            (action === "stress-test" ||
                action === "stress-passengers" ||
                action === "stress-stations" ||
                action === "stress-routes")
        ) {
            event.preventDefault();
            audio.cue("ui");
            applyDebugAction(world, action);
            routeEditor.lastCommand = action;
            syncViewBox();
            render();
            return;
        }

        if (PERF_BUILD && action === "toggle-render-all-passengers") {
            event.preventDefault();
            audio.cue("ui");
            world.debug.renderAllPassengers = !world.debug.renderAllPassengers;
            markAllStationQueuesDirty();
            routeEditor.lastCommand = "toggle-allpax";
            render();
            return;
        }

        if (PERF_BUILD && action === "toggle-dirty-rendering") {
            event.preventDefault();
            audio.cue("ui");
            world.debug.dirtyRendering = !world.debug.dirtyRendering;
            markAllStationQueuesDirty();
            routeEditor.lastCommand = "toggle-dirty";
            render();
            return;
        }

        if (action === "start-game") {
            event.preventDefault();
            audio.cue("start");
            startGame();
            return;
        }

        if (action === "restart-game") {
            event.preventDefault();
            audio.cue("start");
            restart();
            return;
        }

        if (action === "toggle-options") {
            event.preventDefault();
            audio.cue("ui");
            optionsOpen = !optionsOpen;
            render();
            return;
        }

        if (PERF_BUILD && action === "toggle-debug") {
            event.preventDefault();
            audio.cue("ui");
            debugVisible = !debugVisible;
            render();
            return;
        }

        if (PERF_BUILD && action === "toggle-svg-geometry") {
            event.preventDefault();
            audio.cue("ui");
            world.debug.useSvgGeometry = !world.debug.useSvgGeometry;
            routeEditor.lastCommand = "toggle-svg-geometry";
            render();
            return;
        }

        if (action === "toggle-audio") {
            event.preventDefault();
            audio.setEnabled(!audio.enabled);
            if (audio.enabled) audio.cue("ui");
            render();
            return;
        }

        if (action === "save-game") {
            event.preventDefault();
            audio.cue("ui");
            downloadCurrentSvg();
            routeEditor.lastCommand = "save-game";
            render();
            return;
        }

        if (mode === "start" || world.gameOver) return;

        const stationId = findStationId(target);
        if (stationId !== undefined) {
            selectedStationId = stationId;
            applyCommand({ type: "append-station", stationId });
            return;
        }

        const routeId = findRouteId(target);
        if (routeId !== undefined) {
            applyCommand({ type: "select-route", routeId });
        }
    });

    svgRoot.svg.addEventListener("pointerup", (event) => {
        if (!volumeDrag) return;

        event.preventDefault();
        volumeDrag = false;
        if (svgRoot.svg.hasPointerCapture(event.pointerId)) {
            svgRoot.svg.releasePointerCapture(event.pointerId);
        }
    });

    svgRoot.svg.addEventListener("pointercancel", (event) => {
        if (!volumeDrag) return;

        volumeDrag = false;
        if (svgRoot.svg.hasPointerCapture(event.pointerId)) {
            svgRoot.svg.releasePointerCapture(event.pointerId);
        }
    });

    document.addEventListener("keydown", (event) => {
        audio.unlock();

        if (event.key.toLowerCase() === "n") {
            event.preventDefault();
            audio.cue("start");
            restart();
            return;
        }

        const command = keyToCommand(event);
        if (!command) return;

        event.preventDefault();
        applyCommand(command);
    });
}

function setEditorPreview(
    previewStationId: number | undefined,
    invalidStationId: number | undefined,
    hoverRouteId: number | undefined,
): void {
    if (
        routeEditor.previewStationId === previewStationId &&
        routeEditor.invalidStationId === invalidStationId &&
        routeEditor.hoverRouteId === hoverRouteId
    ) {
        return;
    }

    routeEditor.previewStationId = previewStationId;
    routeEditor.invalidStationId = invalidStationId;
    routeEditor.hoverRouteId = hoverRouteId;
    render();
}

function frame(now: number): void {
    const frameMs = now - last;
    const dt = Math.min(frameMs / 1000, 0.25);
    last = now;
    accumulator += dt;

    while (accumulator >= FIXED_DT) {
        tick(world, FIXED_DT);
        accumulator -= FIXED_DT;
    }

    emitWorldAudioEvents();
    audio.update();
    syncViewBox();
    updateFrameStats(stats, frameMs);
    render();
    requestAnimationFrame(frame);
}

function applyCommand(command: GameCommand): void {
    if (mode !== "playing" || world.gameOver) return;
    applyRouteCommand(world, routeEditor, command);
    cueCommand(command);
    render();
}

function markAllStationQueuesDirty(): void {
    for (const station of world.stations.values()) {
        station.dirtyQueue = true;
    }
}

function startGame(): void {
    mode = "playing";
    world = createWorld((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
    renderBackground(svgRoot.layers.background, world.config, world.seed);
    resetRenderState();
    routeEditor = createRouteEditor();
    selectedStationId = undefined;
    audioSnapshot = captureAudioState(world);
    accumulator = 0;
    routeEditor.lastCommand = "start";
    syncViewBox(true);
    render();
}

function restart(): void {
    mode = "playing";
    world = createWorld((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
    renderBackground(svgRoot.layers.background, world.config, world.seed);
    resetRenderState();
    routeEditor = createRouteEditor();
    selectedStationId = undefined;
    audioSnapshot = captureAudioState(world);
    accumulator = 0;
    routeEditor.lastCommand = "restart";
    syncViewBox(true);
    render();
}

function resetRenderState(): void {
    svgRoot.layers.routes.replaceChildren();
    svgRoot.layers.routePreview.replaceChildren();
    svgRoot.layers.stations.replaceChildren();
    svgRoot.layers.trains.replaceChildren();
    svgRoot.layers.passengers.replaceChildren();
    svgRoot.layers.effects.replaceChildren();
    svgRoot.layers.debug.replaceChildren();
    cache = createSvgCache();
    stats.nodeCount = 0;
    lastNodeCountSample = 0;
}

function render(): void {
    const debugStats = {
        ...stats,
        selectedStationId,
        lastCommand: routeEditor.lastCommand,
        draftStations: routeEditor.draftStationIds.length,
    };

    const now = performance.now();
    const shouldSampleNodeCount =
        PERF_BUILD &&
        (stats.nodeCount === 0 ||
            (debugVisible &&
                now - lastNodeCountSample >= NODE_COUNT_SAMPLE_MS));
    renderWorld(
        svgRoot,
        world,
        cache,
        debugStats,
        routeEditor,
        shouldSampleNodeCount,
        currentViewBox,
    );
    if (shouldSampleNodeCount) lastNodeCountSample = now;
    stats.nodeCount = debugStats.nodeCount;
    svgRoot.layers.debug.classList.toggle(
        "is-hidden",
        !PERF_BUILD || !debugVisible,
    );
    renderUi();
}

function syncViewBox(force = false): void {
    if (!force && framedStationCount === world.stations.size) return;

    currentViewBox = stationFitViewBox(world);
    framedStationCount = world.stations.size;
    svgRoot.svg.setAttribute("viewBox", viewBoxToString(currentViewBox));
    syncViewportUi();
}

function syncViewportUi(): void {
    const scale = viewBoxScale(world.config, currentViewBox);
    const x = currentViewBox.x;
    const y = currentViewBox.y;
    const width = currentViewBox.width;
    const height = currentViewBox.height;

    hud.setAttribute(
        "transform",
        `translate(${x + 22 * scale} ${y + 18 * scale}) scale(${scale})`,
    );
    optionsPanel.setAttribute(
        "transform",
        `translate(${x + 370 * scale} ${y + 18 * scale}) scale(${scale})`,
    );
    linePalette.setAttribute(
        "transform",
        `translate(${x + width / 2 - (LINE_PALETTE_WIDTH * scale) / 2} ${y + height - 48 * scale}) scale(${scale})`,
    );
    syncScreenOverlay(startOverlay, currentViewBox, scale);
    syncScreenOverlay(gameOverOverlay, currentViewBox, scale);
}

function syncScreenOverlay(
    group: SVGGElement,
    viewport: SvgViewBox,
    scale: number,
): void {
    const scrim = group.querySelector<SVGRectElement>(".screen-scrim");
    const card = group.querySelector<SVGGElement>(".screen-card");

    if (scrim) {
        scrim.setAttribute("x", String(viewport.x));
        scrim.setAttribute("y", String(viewport.y));
        scrim.setAttribute("width", String(viewport.width));
        scrim.setAttribute("height", String(viewport.height));
    }

    if (card) {
        card.setAttribute(
            "transform",
            `translate(${viewport.x + viewport.width / 2} ${viewport.y + viewport.height / 2}) scale(${scale})`,
        );
    }
}

function renderUi(): void {
    const waiting = [...world.passengers.values()].filter(
        (passenger) => passenger.state === "waiting",
    ).length;
    const riding = [...world.passengers.values()].filter(
        (passenger) => passenger.state === "riding",
    ).length;

    if (ui.status) {
        ui.status.textContent =
            mode === "start"
                ? "READY"
                : world.gameOver
                  ? "OVER"
                  : routeEditor.draftStationIds.length > 0
                    ? "DRAFT"
                    : routeEditor.activeRouteId !== undefined
                      ? "SELECTED"
                      : "RUNNING";
    }

    if (ui.score) ui.score.textContent = String(world.score);
    if (ui.lines) ui.lines.textContent = String(world.routes.size);
    if (ui.waiting) ui.waiting.textContent = String(waiting);
    if (ui.riding) ui.riding.textContent = String(riding);

    if (ui.gameOver) {
        ui.gameOver.classList.toggle(
            "is-visible",
            mode === "playing" && world.gameOver,
        );
    }

    if (ui.start) ui.start.classList.toggle("is-visible", mode === "start");
    if (ui.options) ui.options.classList.toggle("is-visible", optionsOpen);
    if (ui.debugLabel)
        ui.debugLabel.textContent = `Debug overlay ${debugVisible ? "on" : "off"}`;
    if (ui.audioLabel)
        ui.audioLabel.textContent = `Sound ${audio.enabled ? (audio.unlocked ? "on" : "ready") : "off"}`;
    if (ui.volumeLabel)
        ui.volumeLabel.textContent = `Volume ${Math.round(audio.volume * 100)}`;
    if (ui.volumeFill)
        ui.volumeFill.setAttribute(
            "width",
            String(VOLUME_SLIDER_WIDTH * audio.volume),
        );
    if (ui.volumeKnob)
        ui.volumeKnob.setAttribute(
            "x",
            String(VOLUME_SLIDER_WIDTH * audio.volume - 4),
        );
    if (ui.svgGeometryButton)
        ui.svgGeometryButton.textContent = `geom ${world.debug.useSvgGeometry ? "on" : "off"}`;
    if (ui.renderAllButton)
        ui.renderAllButton.textContent = `allpax ${world.debug.renderAllPassengers ? "on" : "off"}`;
    if (ui.dirtyButton)
        ui.dirtyButton.textContent = `dirty ${world.debug.dirtyRendering ? "on" : "off"}`;
    if (ui.meta)
        ui.meta.textContent = `lines ${world.routes.size} unlimited  trains ${world.trains.size}  stations ${world.stations.size}/${world.config.maxStations}`;

    ui.swatches.forEach((swatch, index) => {
        swatch.classList.toggle("is-used", index < world.routes.size);
        swatch.classList.toggle(
            "is-next",
            index === (world.nextRouteId - 1) % ROUTE_COLORS.length &&
                mode === "playing" &&
                !world.gameOver,
        );
    });
}

function updateVolumeFromPointer(event: PointerEvent): void {
    if (!ui.volumeSlider) return;

    const point = localSvgPoint(ui.volumeSlider, event);
    const volume = Math.max(0, Math.min(1, point.x / VOLUME_SLIDER_WIDTH));
    audio.setVolume(volume);
    renderUi();
}

function localSvgPoint(
    element: SVGGraphicsElement,
    event: PointerEvent,
): DOMPoint {
    const point = svgRoot.svg.createSVGPoint();
    const matrix = element.getScreenCTM();

    point.x = event.clientX;
    point.y = event.clientY;
    if (!matrix) return new DOMPoint(0, 0);

    const local = point.matrixTransform(matrix.inverse());
    return new DOMPoint(local.x, local.y);
}

function cueCommand(command: GameCommand): void {
    switch (command.type) {
        case "append-station":
        case "select-route":
            audio.cue("select");
            return;
        case "commit-route":
            audio.cue("commit");
            return;
        case "undo-route":
        case "cancel-route":
        case "reset-route":
            audio.cue("cancel");
            return;
    }
}

function emitWorldAudioEvents(): void {
    if (mode !== "playing") {
        audioSnapshot = captureAudioState(world);
        return;
    }

    if (world.stations.size > audioSnapshot.stations) audio.cue("station");
    if (world.score > audioSnapshot.score) audio.cue("deliver");
    if (!world.gameOver && hasCongestionWarning(world)) audio.cue("congestion");
    if (world.gameOver && !audioSnapshot.gameOver) audio.cue("gameover");
    audioSnapshot = captureAudioState(world);
}

function hasCongestionWarning(source: World): boolean {
    for (const station of source.stations.values()) {
        if (
            station.queue.length > source.config.queueWarning ||
            station.overcrowd > source.config.overcrowdLimit * 0.45
        )
            return true;
    }

    return false;
}

function captureAudioState(source: World): {
    stations: number;
    score: number;
    gameOver: boolean;
} {
    return {
        stations: source.stations.size,
        score: source.score,
        gameOver: source.gameOver,
    };
}

function downloadCurrentSvg(): void {
    const svgText = createPlayableSvgExport();
    const blob = new Blob([svgText], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "a",
    ) as HTMLAnchorElement;

    link.href = url;
    link.download = `minimetro-${world.seed}-${world.tick}.svg`;
    link.click();
    URL.revokeObjectURL(url);
}

function createPlayableSvgExport(): string {
    return createPlayableSvgDocument({
        width: world.config.mapWidth,
        height: world.config.mapHeight,
        metadata: encodeWorld(world),
        style: document.querySelector("style")?.textContent ?? "",
        script: document.querySelector("script")?.textContent ?? "",
    });
}

function keyToCommand(event: KeyboardEvent): GameCommand | undefined {
    if (event.key === "Backspace") return { type: "undo-route" };
    if (event.key === "Escape") return { type: "cancel-route" };
    if (event.key === "Enter") return { type: "commit-route" };
    if (event.key.toLowerCase() === "r") return { type: "reset-route" };

    return undefined;
}
