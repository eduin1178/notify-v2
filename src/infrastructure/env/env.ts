import { parseEnv, type Env } from "./schema";

export type { Env };

export const env: Env = parseEnv();
