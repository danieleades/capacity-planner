import { sqliteTable, text, real, integer, index, unique } from 'drizzle-orm/sqlite-core';

/**
 * Teams table
 * Stores team information including name and default monthly capacity
 */
export const teams = sqliteTable('teams', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	monthlyCapacity: real('monthly_capacity').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

/**
 * Capacity overrides table
 * Stores month-specific capacity overrides for teams
 * Allows teams to have different capacity in specific months
 */
export const capacityOverrides = sqliteTable(
	'capacity_overrides',
	{
		id: text('id').primaryKey(),
		teamId: text('team_id')
			.notNull()
			.references(() => teams.id, { onDelete: 'cascade' }),
		yearMonth: text('year_month').notNull(), // Format: "YYYY-MM"
		capacity: real('capacity').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
	},
	(table) => [
		index('capacity_overrides_team_id_idx').on(table.teamId),
		unique('capacity_overrides_team_month_unique').on(table.teamId, table.yearMonth)
	]
);

/**
 * Work packages table
 * Stores work items that can be assigned to teams
 */
export const workPackages = sqliteTable(
	'work_packages',
	{
		id: text('id').primaryKey(),
		title: text('title').notNull(),
		description: text('description'),
		sizeInPersonMonths: real('size_in_person_months').notNull(),
		priority: integer('priority').notNull(),
		assignedTeamId: text('assigned_team_id').references(() => teams.id, { onDelete: 'set null' }),
		scheduledPosition: integer('scheduled_position'),
		progressPercent: integer('progress_percent').notNull().default(0),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
	},
	(table) => [
		index('work_packages_assigned_team_idx').on(table.assignedTeamId),
		index('work_packages_priority_idx').on(table.priority)
	]
);
