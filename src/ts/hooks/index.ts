import { CanvasReady } from "./canvas-ready.ts";
import { Init } from "./init.ts";
import { Setup } from "./setup.ts";

interface Listener {
    listen(): void;
}

const HooksModule: Listener = {
    listen(): void {
        const listeners: Listener[] = [Init, Setup, CanvasReady];

        for (const listener of listeners) {
            listener.listen();
        }
    },
};

export { HooksModule };
export type { Listener };
