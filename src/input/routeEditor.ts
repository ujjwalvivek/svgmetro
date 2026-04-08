import type { Route, RouteId, StationId, World } from "../sim/types";
import { boardAt } from "../sim/passengers";
import { hasLineSlot } from "../sim/resources";
import { invalidateRouteGraph } from "../sim/routing";
import { removeRouteTrains, resetTrainForRoute } from "../sim/trains";

export type GameCommand =
    | { type: "append-station"; stationId: StationId }
    | { type: "select-route"; routeId: number }
    | { type: "undo-route" }
    | { type: "cancel-route" }
    | { type: "reset-route" }
    | { type: "commit-route" };

export interface RouteEditor {
    draftStationIds: StationId[];
    activeRouteId?: number;
    previewStationId?: StationId;
    invalidStationId?: StationId;
    hoverRouteId?: RouteId;
    lastCommand: string;
}

export const ROUTE_COLORS = [
    "#e8442e",
    "#11a8d8",
    "#f4c400",
    "#08864a",
    "#cf5574",
    "#a45f37",
    "#24aaa6",
] as const;

export function createRouteEditor(): RouteEditor {
    return {
        draftStationIds: [],
        lastCommand: "-",
    };
}

export function applyRouteCommand(
    world: World,
    editor: RouteEditor,
    command: GameCommand,
): boolean {
    editor.lastCommand = command.type;

    switch (command.type) {
        case "append-station":
            return appendStation(world, editor, command.stationId);
        case "select-route":
            return selectRoute(world, editor, command.routeId);
        case "undo-route":
            return undoRoute(editor);
        case "cancel-route":
            return cancelRoute(editor);
        case "reset-route":
            return resetRoute(world, editor);
        case "commit-route":
            return commitRoute(world, editor);
    }
}

function selectRoute(
    world: World,
    editor: RouteEditor,
    routeId: number,
): boolean {
    if (!world.routes.has(routeId)) return false;

    editor.activeRouteId = routeId;
    editor.hoverRouteId = routeId;
    editor.invalidStationId = undefined;
    editor.draftStationIds = [];

    return true;
}

function appendStation(
    world: World,
    editor: RouteEditor,
    stationId: StationId,
): boolean {
    if (!world.stations.has(stationId)) return false;

    if (editor.draftStationIds.includes(stationId)) {
        editor.invalidStationId = stationId;
        editor.previewStationId = undefined;
        return false;
    }

    editor.draftStationIds.push(stationId);
    editor.invalidStationId = undefined;
    editor.previewStationId = undefined;
    return true;
}

function undoRoute(editor: RouteEditor): boolean {
    if (editor.draftStationIds.length === 0) return false;

    editor.draftStationIds.pop();
    editor.invalidStationId = undefined;
    editor.previewStationId = undefined;
    return true;
}

function cancelRoute(editor: RouteEditor): boolean {
    if (editor.draftStationIds.length === 0) return false;

    editor.draftStationIds = [];
    editor.invalidStationId = undefined;
    editor.previewStationId = undefined;
    return true;
}

function resetRoute(world: World, editor: RouteEditor): boolean {
    if (editor.draftStationIds.length > 0) {
        editor.draftStationIds = [];
        editor.invalidStationId = undefined;
        editor.previewStationId = undefined;
        return true;
    }

    const hadDraft = editor.draftStationIds.length > 0;
    const hadRoute =
        editor.activeRouteId !== undefined &&
        world.routes.has(editor.activeRouteId);

    if (editor.activeRouteId !== undefined) {
        const route = world.routes.get(editor.activeRouteId);
        if (route) removeRouteTrains(world, route);
        world.routes.delete(editor.activeRouteId);
        invalidateRouteGraph(world);
    }

    editor.draftStationIds = [];
    editor.activeRouteId = undefined;
    editor.invalidStationId = undefined;
    editor.hoverRouteId = undefined;
    editor.previewStationId = undefined;
    return hadDraft || hadRoute;
}

function commitRoute(world: World, editor: RouteEditor): boolean {
    if (editor.draftStationIds.length < 2) return false;

    if (hasDuplicateRoute(world, editor.draftStationIds)) {
        editor.lastCommand = "duplicate-route";
        editor.invalidStationId = editor.draftStationIds.at(-1);
        return false;
    }

    if (!hasLineSlot(world)) {
        editor.lastCommand = "no-lines";
        return false;
    }

    const route: Route = {
        id: world.nextRouteId,
        color: routeColor(world.nextRouteId),
        stationIds: [...editor.draftStationIds],
        trainIds: [],
        closed: false,
        dirtyPath: true,
    };

    world.nextRouteId += 1;
    world.routes.set(route.id, route);
    invalidateRouteGraph(world);
    const train = resetTrainForRoute(world, route);
    boardTrainAtRouteStart(world, route, train.id);
    editor.activeRouteId = route.id;
    editor.draftStationIds = [];
    editor.invalidStationId = undefined;
    editor.previewStationId = undefined;
    return true;
}

function hasDuplicateRoute(world: World, stationIds: StationId[]): boolean {
    return [...world.routes.values()].some((route) =>
        sameStationSequence(route.stationIds, stationIds) ||
            sameStationSequence(route.stationIds, [...stationIds].reverse()),
    );
}

function sameStationSequence(a: StationId[], b: StationId[]): boolean {
    return a.length === b.length && a.every((stationId, index) => stationId === b[index]);
}

function boardTrainAtRouteStart(
    world: World,
    route: Route,
    trainId: number,
): void {
    const train = world.trains.get(trainId);
    const station = world.stations.get(route.stationIds[0]!);
    if (train && station) boardAt(world, train, station);
}

export function draftRouteColor(world: World): string {
    return routeColor(world.nextRouteId);
}

function routeColor(routeId: number): string {
    return ROUTE_COLORS[(routeId - 1) % ROUTE_COLORS.length]!;
}
