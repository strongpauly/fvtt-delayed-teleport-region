import type * as fields from "@common/data/fields.mjs";
import type { EventBehaviorStaticHandler } from "../../types/foundry/client/data/region-behaviors/base.d.mts";
import type { TeleportTokenRegionBehaviorTypeSchema } from "../../types/foundry/client/data/region-behaviors/teleport-token.d.mts";
import type { TokenBasicMoveRegionEvent } from "../../types/foundry/client/documents/region.d.mts";
import { MODULE_ID } from "./constants.ts";
import { logger } from "./logger/logger.ts";

export type DelayedTeleportTokenRegionBehaviorTypeSchema =
    TeleportTokenRegionBehaviorTypeSchema & {
        delayAmount: foundry.data.fields.NumberField<
            number,
            number,
            true,
            false
        >;
        showCountdown: foundry.data.fields.BooleanField;
    };

export class DelayedTeleportTokenRegionBehaviourType extends foundry.data
    .regionBehaviors
    .RegionBehaviorType<DelayedTeleportTokenRegionBehaviorTypeSchema> {
    name = "Delayed Teleport Token";
    static override LOCALIZATION_PREFIXES = [
        ...foundry.data.regionBehaviors.TeleportTokenRegionBehaviorType
            .LOCALIZATION_PREFIXES,
        MODULE_ID,
    ];
    static override defineSchema(): DelayedTeleportTokenRegionBehaviorTypeSchema {
        return {
            ...foundry.data.regionBehaviors.TeleportTokenRegionBehaviorType.defineSchema(),
            delayAmount: new foundry.data.fields.NumberField({
                label: `${MODULE_ID}.FIELDS.delayAmount.name`,
                hint: `${MODULE_ID}.FIELDS.delayAmount.hint`,
                required: true,
            }),
            showCountdown: new foundry.data.fields.BooleanField({
                label: `${MODULE_ID}.FIELDS.showCountdown.name`,
                hint: `${MODULE_ID}.FIELDS.showCountdown.hint`,
                initial: true,
            }),
        };
    }

    static async #onTokenMoveIn(
        this: fields.ModelPropsFromSchema<DelayedTeleportTokenRegionBehaviorTypeSchema>,
        event: TokenBasicMoveRegionEvent,
    ) {
        let countDown = this.delayAmount;
        const tokenDocument = event.data.token;
        const token = tokenDocument.object;
        if (!token) {
            return;
        }
        const doTick = async (time: number) => {
            const p: Promise<any>[] = [];
            logger.debug(`Counting down on token ${token.id} to ${time}`);
            if (this.showCountdown) {
                p.push(
                    canvas.interface.createScrollingText(
                        token.center,
                        `${time}`,
                        {
                            anchor: 0,
                            distance: 2 * token.h,
                            fontSize: time <= 3 ? 64 : time <= 10 ? 48 : 28,
                            fill: time > 10 ? 0x00ff00 : 0xff0000,
                            stroke: 0x000000,
                            strokeThickness: 4,
                        },
                    ),
                );
            }
            p.push(
                tokenDocument.setFlag(
                    MODULE_ID,
                    "teleportTimerCountDown",
                    time - 1,
                ),
            );
            await Promise.all(p);
        };

        if (!tokenDocument.getFlag(MODULE_ID, "teleportTimerInterval")) {
            logger.debug(
                `Creating timer on token ${token.id}.  Starting at ${countDown}`,
            );
            const interval = setInterval(async () => {
                if (game.paused) {
                    logger.debug(
                        `Game is paused.  Skipping timer on token ${token.id}`,
                    );
                    return;
                }
                const currentCount = token.document.getFlag(
                    MODULE_ID,
                    "teleportTimerCountDown",
                ) as number;

                if (currentCount > 0) {
                    return await doTick(currentCount);
                }
                logger.debug(
                    `Timer on token ${token.id} complete.  Teleporting to ${this.destination}`,
                );
                DelayedTeleportTokenRegionBehaviourType.#clearInterval(
                    tokenDocument,
                );
                // Until https://github.com/foundryvtt/foundryvtt/issues/10828 is implemented in v13
                await foundry.data.regionBehaviors.TeleportTokenRegionBehaviorType.events.tokenMoveIn.bind(
                    this as any,
                )({ data: { token: tokenDocument }, user: game.user } as any);
            }, 1000);
            await Promise.all([
                tokenDocument.setFlag(
                    MODULE_ID,
                    "teleportTimerInterval",
                    interval,
                ),
                doTick(countDown),
            ]);
        }
    }

    static #clearInterval(tokenDocument: TokenDocument) {
        const interval = tokenDocument.getFlag(
            MODULE_ID,
            "teleportTimerInterval",
        ) as number | undefined;
        if (interval) {
            logger.debug(`Clearing timer on token ${tokenDocument.id}`);
            clearInterval(interval);
            tokenDocument.setFlag(MODULE_ID, "teleportTimerInterval", null);
        }
    }

    static #onTokenMoveOut(event: TokenBasicMoveRegionEvent) {
        const tokenDocument = event.data.token;
        DelayedTeleportTokenRegionBehaviourType.#clearInterval(tokenDocument);
    }

    static override events: Record<string, EventBehaviorStaticHandler> = {
        [CONST.REGION_EVENTS.TOKEN_MOVE_IN]: this.#onTokenMoveIn,
        [CONST.REGION_EVENTS.TOKEN_MOVE_OUT]: this.#onTokenMoveOut,
    } as any;
}
