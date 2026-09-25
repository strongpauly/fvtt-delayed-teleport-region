import { DelayedTeleportTokenRegionBehaviourType } from "../region-behaviour.ts";
import { Listener } from "./index.ts";

export const Ready: Listener = {
    listen(): void {
        Hooks.once("ready", () => {
            DelayedTeleportTokenRegionBehaviourType.resumeCountdowns();
        });
    },
};
