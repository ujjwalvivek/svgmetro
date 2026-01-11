import type { World } from "./types";
import { spawnStation, stationSpawnInterval } from "./world";

export function updateStationGrowth(world: World, dt: number): void {
    if (world.stations.size >= world.config.maxStations) {
        world.stationSpawnCooldown = 0;
        return;
    }

    world.stationSpawnCooldown -= dt;

    if (world.stationSpawnCooldown > 0) return;

    spawnStation(world);
    world.stationSpawnCooldown = stationSpawnInterval(world);
}
