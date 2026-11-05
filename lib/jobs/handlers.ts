import "server-only";

/** Job type → handler. Handlers MUST be idempotent: a job can run more than once. */
export const handlers: Record<string, (payload: Record<string, unknown>) => Promise<void>> = {};
