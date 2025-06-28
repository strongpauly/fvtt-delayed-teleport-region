import { MODULE_ID } from "../constants.ts";

class Logger {
    info(message: string): void {
        console.info(`[${MODULE_ID}]`, message);
    }
    debug(message: string): void {
        console.debug(`[${MODULE_ID}]`, message);
    }
    error(message: string): void {
        console.error(`[${MODULE_ID}]`, message);
    }
    warn(message: string): void {
        console.warn(`[${MODULE_ID}]`, message);
    }
}

export const logger = new Logger();
