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

/** Persisted on the token so a countdown can be resumed after a page refresh. */
interface TeleportTimerFlag {
    /** Seconds remaining. */
    countDown: number;
    /** UUID of the RegionBehavior that started the countdown. */
    behavior: string;
    /** ID of the User whose client drives the countdown. */
    user: string;
}

const TIMER_FLAG = "teleportTimer";

/** Client-local intervals keyed by token UUID. */
const intervals = new Map<string, ReturnType<typeof setInterval>>();

export interface DelayedTeleportTokenRegionBehaviourType
    extends fields.ModelPropsFromSchema<DelayedTeleportTokenRegionBehaviorTypeSchema> {}

export class DelayedTeleportTokenRegionBehaviourType extends foundry.data
    .regionBehaviors.TeleportTokenRegionBehaviorType {
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

    /**
     * Resume any countdowns persisted on tokens in every scene, so the driving
     * user keeps counting down scenes they aren't viewing.
     * Called on the ready hook.
     */
    static resumeCountdowns(): void {
        for (const tokenDocument of game.scenes.contents.flatMap(
            (s) => s.tokens.contents,
        )) {
            const flag = tokenDocument.getFlag(MODULE_ID, TIMER_FLAG) as
                | TeleportTimerFlag
                | undefined;
            if (!flag) continue;
            const behavior = fromUuidSync(flag.behavior);
            if (
                !(behavior instanceof RegionBehavior) ||
                behavior.disabled ||
                !(
                    behavior.system instanceof
                    DelayedTeleportTokenRegionBehaviourType
                ) ||
                !tokenDocument.regions.has(behavior.region)
            ) {
                continue;
            }
            logger.debug(
                `Resuming timer on token ${tokenDocument.id} at ${flag.countDown}`,
            );
            DelayedTeleportTokenRegionBehaviourType.#startCountdown.call(
                behavior.system,
                tokenDocument,
                game.users.get(flag.user),
            );
        }
    }

    static async #onTokenMoveIn(
        this: DelayedTeleportTokenRegionBehaviourType,
        event: TokenBasicMoveRegionEvent,
    ) {
        const tokenDocument = event.data.token;
        if (intervals.has(tokenDocument.uuid)) return;
        // The active GM drives the countdown so a laggy player can't stall it.
        const driver = game.users.activeGM ?? event.user;
        if (event.user.isSelf) {
            logger.debug(
                `Creating timer on token ${tokenDocument.id}.  Starting at ${this.delayAmount}`,
            );
            const flag: TeleportTimerFlag = {
                countDown: this.delayAmount,
                behavior: this.behavior!.uuid!,
                user: driver.id,
            };
            await tokenDocument.setFlag(MODULE_ID, TIMER_FLAG, flag);
        }
        DelayedTeleportTokenRegionBehaviourType.#startCountdown.call(
            this,
            tokenDocument,
            driver,
        );
    }

    /**
     * Run the countdown on this client. Every client displays the countdown,
     * but only the driving user's client (the active GM, or the moving user if
     * no GM was connected) decrements the persisted count. If the driving user
     * disconnects, the active GM takes over.
     */
    static #startCountdown(
        this: DelayedTeleportTokenRegionBehaviourType,
        tokenDocument: TokenDocument,
        user: User | undefined,
    ) {
        const isWriter = () =>
            user?.isSelf || (!user?.active && game.user.isActiveGM);

        const tick = async () => {
            if (
                !tokenDocument.parent?.tokens.has(tokenDocument.id) ||
                !tokenDocument.regions.has(this.region as RegionDocument<Scene>)
            ) {
                logger.debug(
                    `Token ${tokenDocument.id} deleted or left region.  Cancelling timer`,
                );
                DelayedTeleportTokenRegionBehaviourType.#clearInterval(
                    tokenDocument,
                );
                return;
            }
            if (game.paused) {
                logger.debug(
                    `Game is paused.  Skipping timer on token ${tokenDocument.id}`,
                );
                return;
            }
            const flag = tokenDocument.getFlag(MODULE_ID, TIMER_FLAG) as
                | TeleportTimerFlag
                | undefined;
            // Flag not yet arrived from the driving client.
            if (!flag) return;

            if (flag.countDown > 0) {
                logger.debug(
                    `Counting down on token ${tokenDocument.id} to ${flag.countDown}`,
                );
                const p: Promise<unknown>[] = [];
                if (this.showCountdown && tokenDocument.object) {
                    const token = tokenDocument.object;
                    const time = flag.countDown;
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
                if (isWriter()) {
                    p.push(
                        tokenDocument.update({
                            [`flags.${MODULE_ID}.${TIMER_FLAG}.countDown`]:
                                flag.countDown - 1,
                        }),
                    );
                }
                await Promise.all(p);
                return;
            }

            logger.debug(
                `Timer on token ${tokenDocument.id} complete.  Teleporting`,
            );
            DelayedTeleportTokenRegionBehaviourType.#clearInterval(
                tokenDocument,
            );
            // The flag is left at 0 so every client observes completion and
            // invokes the base handler, which decides who teleports. The
            // TOKEN_MOVE_OUT triggered by the teleport removes the flag.
            await foundry.data.regionBehaviors.TeleportTokenRegionBehaviorType.events.tokenMoveIn.bind(
                this as any,
            )({
                data: {
                    token: tokenDocument,
                    movement: {
                        id: tokenDocument.movement?.id,
                        passed: { waypoints: [{ action: "" }] },
                    },
                },
                user: user ?? game.user,
            } as any);
        };

        intervals.set(tokenDocument.uuid, setInterval(tick, 1000));
        void tick();
    }

    static #clearInterval(tokenDocument: TokenDocument) {
        const interval = intervals.get(tokenDocument.uuid);
        if (interval !== undefined) {
            logger.debug(`Clearing timer on token ${tokenDocument.id}`);
            clearInterval(interval);
            intervals.delete(tokenDocument.uuid);
        }
    }

    static async #onTokenMoveOut(event: TokenBasicMoveRegionEvent) {
        const tokenDocument = event.data.token;
        DelayedTeleportTokenRegionBehaviourType.#clearInterval(tokenDocument);
        if (event.user.isSelf && tokenDocument.getFlag(MODULE_ID, TIMER_FLAG)) {
            await tokenDocument.unsetFlag(MODULE_ID, TIMER_FLAG);
        }
    }

    static override events: Record<string, EventBehaviorStaticHandler> = {
        [CONST.REGION_EVENTS.TOKEN_MOVE_IN]: this.#onTokenMoveIn,
        [CONST.REGION_EVENTS.TOKEN_MOVE_OUT]: this.#onTokenMoveOut,
    } as any;
}
