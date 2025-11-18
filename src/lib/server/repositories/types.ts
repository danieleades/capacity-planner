import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { teams, workPackages, capacityOverrides } from '../schema';

/**
 * Base entity types inferred from Drizzle schema
 * These automatically stay in sync with schema changes
 */
export type Team = InferSelectModel<typeof teams>;
export type WorkPackage = InferSelectModel<typeof workPackages>;
export type CapacityOverride = InferSelectModel<typeof capacityOverrides>;

/**
 * Input types for creating new entities
 * Omits id and timestamps which are generated automatically
 */
export type NewTeam = Omit<InferInsertModel<typeof teams>, 'id' | 'createdAt' | 'updatedAt'>;
export type NewWorkPackage = Omit<
	InferInsertModel<typeof workPackages>,
	'id' | 'createdAt' | 'updatedAt' | 'priority'
>;
export type NewCapacityOverride = Omit<
	InferInsertModel<typeof capacityOverrides>,
	'id' | 'createdAt' | 'updatedAt'
>;

/**
 * Update types - all fields optional except id, createdAt, updatedAt
 */
export type TeamUpdate = Partial<Omit<Team, 'id' | 'createdAt' | 'updatedAt'>>;
export type WorkPackageUpdate = Partial<Omit<WorkPackage, 'id' | 'createdAt' | 'updatedAt'>>;
export type CapacityOverrideUpdate = Partial<
	Omit<CapacityOverride, 'id' | 'createdAt' | 'updatedAt'>
>;

/**
 * Type-safe database parameter for dependency injection
 */
export type DbParam = typeof import('../db').db;
