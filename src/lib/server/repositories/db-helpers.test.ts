import { describe, it, expect } from 'vitest';
import { dbOperation, withTimestamps, withUpdatedTimestamp } from './db-helpers';
import { ZodError, z } from 'zod';

describe('db-helpers', () => {
	describe('dbOperation', () => {
		it('should execute successful sync operations', () => {
			const result = dbOperation(() => 42, 'Test operation');
			expect(result).toBe(42);
		});

		it('should execute successful async operations', async () => {
			const result = await dbOperation(() => Promise.resolve(42), 'Test operation');
			expect(result).toBe(42);
		});

		it('should preserve original error for sync operations', () => {
			const originalError = new Error('Original validation error');
			expect(() => {
				dbOperation(() => {
					throw originalError;
				}, 'Failed to do something');
			}).toThrow(originalError);
		});

		it('should preserve original error for async operations', async () => {
			const originalError = new Error('Original validation error');
			await expect(
				dbOperation(() => Promise.reject(originalError), 'Failed to do something')
			).rejects.toThrow(originalError);
		});

		it('should preserve ZodError details', () => {
			const schema = z.object({
				name: z.string().min(1, 'Name is required'),
				age: z.number().min(0, 'Age must be positive')
			});

			try {
				dbOperation(() => {
					// This will throw a ZodError with validation issues
					schema.parse({ name: '', age: -1 });
					return true;
				}, 'Failed to validate');
				expect.fail('Should have thrown an error');
			} catch (error) {
				expect(error).toBeInstanceOf(ZodError);
				const zodError = error as ZodError;
				expect(zodError.issues.length).toBeGreaterThan(0);
				// Verify that the error details are preserved
				const nameIssue = zodError.issues.find(issue => issue.path[0] === 'name');
				const ageIssue = zodError.issues.find(issue => issue.path[0] === 'age');
				expect(nameIssue).toBeDefined();
				expect(ageIssue).toBeDefined();
			}
		});

		it('should preserve custom validation errors', () => {
			const customError = new Error('Validation failed for create team: name is required, capacity must be positive');

			expect(() => {
				dbOperation(() => {
					throw customError;
				}, 'Failed to create team');
			}).toThrow('Validation failed for create team: name is required, capacity must be positive');
		});
	});

	describe('withTimestamps', () => {
		it('should add createdAt and updatedAt timestamps', () => {
			const data = { id: '123', name: 'Test' };
			const result = withTimestamps(data);

			expect(result.id).toBe('123');
			expect(result.name).toBe('Test');
			expect(result.createdAt).toBeInstanceOf(Date);
			expect(result.updatedAt).toBeInstanceOf(Date);
		});

		it('should throw error if id is missing', () => {
			expect(() => {
				withTimestamps({ name: 'Test' } as { id: string; name: string });
			}).toThrow('withTimestamps requires an id field');
		});
	});

	describe('withUpdatedTimestamp', () => {
		it('should add updatedAt timestamp', () => {
			const data = { name: 'Test', value: 42 };
			const result = withUpdatedTimestamp(data);

			expect(result.name).toBe('Test');
			expect(result.value).toBe(42);
			expect(result.updatedAt).toBeInstanceOf(Date);
		});

		it('should preserve existing fields', () => {
			const data = { id: '123', name: 'Test', capacity: 5.0 };
			const result = withUpdatedTimestamp(data);

			expect(result.id).toBe('123');
			expect(result.name).toBe('Test');
			expect(result.capacity).toBe(5.0);
			expect(result.updatedAt).toBeInstanceOf(Date);
		});
	});
});
