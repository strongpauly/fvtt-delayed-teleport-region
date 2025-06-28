import { MODULE_ID } from "../constants.ts";
import { logger } from "../logger/logger.ts";
import { DelayedTeleportTokenRegionBehaviourType } from "../region-behaviour.ts";
import { Listener } from "./index.ts";

const Init: Listener = {
    listen(): void {
        Hooks.once("init", () => {
            // new Settings().register();
            // new HandlebarHelpers().register();

            const key = `${MODULE_ID}.delayedTeleportToken`;

            CONFIG.RegionBehavior.dataModels[key] =
                DelayedTeleportTokenRegionBehaviourType;

            CONFIG.RegionBehavior.typeIcons[key] = `fa-solid fa-timer`;

            // (game.modules.get(MODULE_ID) as DelayedTeleportRegionModule).api =
            //     new DelayedTeleportRegionModuleApi();

            logger.info("Initialization complete");
        });
    },
};

export { Init };
