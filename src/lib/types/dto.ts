/**
 * DTO types for reorder operations
 * Provides a unified shape for drag-and-drop work package reordering
 */

/**
 * DTO used for server communication and KanbanBoard component
 * Uses `teamId` (null for unassigned) and `position` (0-indexed)
 */
export interface ReorderUpdate {
	id: string;
	teamId: string | null;
	position: number;
}

/**
 * DTO used for internal store operations
 * Uses `assignedTeamId` (undefined for unassigned) and `scheduledPosition`
 * Matches the WorkPackage type conventions
 */
export interface StoreReorderUpdate {
	id: string;
	assignedTeamId: string | undefined;
	scheduledPosition: number;
}

/**
 * Convert a server/component DTO to store format
 */
export function toStoreUpdate(dto: ReorderUpdate): StoreReorderUpdate {
	return {
		id: dto.id,
		assignedTeamId: dto.teamId ?? undefined,
		scheduledPosition: dto.position
	};
}

/**
 * Convert a store update to server/component DTO format
 */
export function toServerDto(update: StoreReorderUpdate): ReorderUpdate {
	return {
		id: update.id,
		teamId: update.assignedTeamId ?? null,
		position: update.scheduledPosition
	};
}
