import { optimistikit } from 'optimistikit';

/**
 * Extract the enhance action type from optimistikit
 * Generic type that preserves type safety for the data parameter
 * 
 * Usage:
 *   import type { PageData } from './$types';
 *   import type { OptimisticEnhanceAction } from '$lib/types/optimistic';
 * 
 *   const enhance: OptimisticEnhanceAction<PageData> = get_action<PageData>();
 */
export type OptimisticEnhanceAction<TData> = ReturnType<typeof optimistikit<TData>>['enhance'];
