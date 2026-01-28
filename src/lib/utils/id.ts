/**
 * ID generation utilities
 *
 * Re-exports typed ID generators from branded types module.
 * Use these for creating new IDs. The untyped generateId is kept for
 * backwards compatibility but prefer the typed versions.
 */

export { generateTeamId, generateWorkPackageId } from '$lib/types/branded';

/**
 * Generic ID generator - kept for backwards compatibility
 * Prefer generateTeamId or generateWorkPackageId for type safety
 */
export const generateId = () => crypto.randomUUID();
