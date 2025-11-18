/**
 * Standard database operation wrapper with error handling
 * Provides consistent error logging and error message formatting
 * Supports both sync and async operations
 */
export function dbOperation<T>(operation: () => T, errorMessage: string): T;
export function dbOperation<T>(operation: () => Promise<T>, errorMessage: string): Promise<T>;
export function dbOperation<T>(
	operation: () => T | Promise<T>,
	errorMessage: string
): T | Promise<T> {
	try {
		const result = operation();
		if (result instanceof Promise) {
			return result.catch((error) => {
				console.error(`${errorMessage}:`, error);
				throw new Error(errorMessage);
			});
		}
		return result;
	} catch (error) {
		console.error(`${errorMessage}:`, error);
		throw new Error(errorMessage);
	}
}

/**
 * Helper for insert operations with timestamps and ID generation
 * Combines multiple operations that always happen together
 */
export function withTimestamps<T extends Record<string, unknown>>(data: T) {
	const now = new Date();
	return {
		...data,
		id: crypto.randomUUID(),
		createdAt: now,
		updatedAt: now
	};
}

/**
 * Helper for update operations with timestamp
 * Ensures updatedAt is always set on updates
 */
export function withUpdatedTimestamp<T extends Record<string, unknown>>(data: T) {
	return {
		...data,
		updatedAt: new Date()
	};
}
