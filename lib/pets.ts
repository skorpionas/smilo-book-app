/** Pet enums shared by forms (client) and schemas (server); kept free of zod so it stays tiny. */
export const SPECIES = ["dog", "cat"] as const;
export const SIZES = ["xs", "s", "m", "l", "xl"] as const;
export type Species = (typeof SPECIES)[number];
export type Size = (typeof SIZES)[number];
