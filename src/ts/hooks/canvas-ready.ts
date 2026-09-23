import { DelayedTeleportTokenRegionBehaviourType } from "../region-behaviour.ts";
import { Listener } from "./index.ts";

export const CanvasReady: Listener = {
    listen(): void {
        Hooks.on("canvasReady", () => {
            DelayedTeleportTokenRegionBehaviourType.resumeCountdowns();
        });
    },
};
