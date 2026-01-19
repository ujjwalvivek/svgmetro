import { updateCongestion } from "./congestion";
import { updateStationGrowth } from "./growth";
import { handleTrainArrivals, spawnPassengers } from "./passengers";
import type { World } from "./types";
import { moveTrains } from "./trains";

export const FIXED_DT = 1 / 60;

export function tick(world: World, dt: number): void {
    if (world.gameOver) {
        moveTrains(world, dt);
        return;
    }

    world.time += dt;
    world.tick += 1;

    spawnPassengers(world, dt);
    updateStationGrowth(world, dt);
    moveTrains(world, dt);
    handleTrainArrivals(world);
    updateCongestion(world, dt);
}
