import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import WorkPackageModal from './WorkPackageModal.svelte';
import type { OptimisticEnhanceAction } from '$lib/types/optimistic';
import type { PlanningPageData, WorkPackage } from '$lib/types';

describe('WorkPackageModal', () => {
	const mockOptimisticEnhance = vi.fn((_node, _callback) => {
		return {
			update: () => {},
			destroy: () => {}
		};
	}) as unknown as OptimisticEnhanceAction<PlanningPageData>;

	const mockOnClose = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('modal open/close behavior', () => {
		it('should not render when open is false', () => {
			render(WorkPackageModal, {
				props: {
					optimisticEnhance: mockOptimisticEnhance,
					open: false,
					onClose: mockOnClose
				}
			});

			expect(screen.queryByRole('heading', { name: 'Add Work Package' })).not.toBeInTheDocument();
		});

		it('should render when open is true', () => {
			render(WorkPackageModal, {
				props: {
					optimisticEnhance: mockOptimisticEnhance,
					open: true,
					onClose: mockOnClose
				}
			});

			expect(screen.getByRole('heading', { name: 'Add Work Package' })).toBeInTheDocument();
		});

		it('should show "Add Work Package" title when creating new work package', () => {
			render(WorkPackageModal, {
				props: {
					optimisticEnhance: mockOptimisticEnhance,
					open: true,
					onClose: mockOnClose
				}
			});

			expect(screen.getByRole('heading', { name: 'Add Work Package' })).toBeInTheDocument();
		});

		it('should show "Edit Work Package" title when editing existing work package', () => {
			const editingWorkPackage: WorkPackage = {
				id: 'wp-1',
				title: 'Test Work Package',
				description: 'Test description',
				sizeInPersonMonths: 2.5,
				priority: 0,
				assignedTeamId: undefined,
				scheduledPosition: undefined
			};

			render(WorkPackageModal, {
				props: {
					optimisticEnhance: mockOptimisticEnhance,
					open: true,
					editingWorkPackage,
					onClose: mockOnClose
				}
			});

			expect(screen.getByText('Edit Work Package')).toBeInTheDocument();
		});
	});

	describe('form behavior', () => {
		it('should have form with createWorkPackage action when creating', () => {
			const { container } = render(WorkPackageModal, {
				props: {
					optimisticEnhance: mockOptimisticEnhance,
					open: true,
					onClose: mockOnClose
				}
			});

			const form = container.querySelector('form[action="?/createWorkPackage"]');
			expect(form).toBeInTheDocument();
			expect(form).toHaveAttribute('method', 'POST');
		});

		it('should have form with updateWorkPackage action when editing', () => {
			const editingWorkPackage: WorkPackage = {
				id: 'wp-1',
				title: 'Test Work Package',
				description: 'Test description',
				sizeInPersonMonths: 2.5,
				priority: 0,
				assignedTeamId: undefined,
				scheduledPosition: undefined
			};

			const { container } = render(WorkPackageModal, {
				props: {
					optimisticEnhance: mockOptimisticEnhance,
					open: true,
					editingWorkPackage,
					onClose: mockOnClose
				}
			});

			const form = container.querySelector('form[action="?/updateWorkPackage"]');
			expect(form).toBeInTheDocument();
			expect(form).toHaveAttribute('method', 'POST');
		});

		it('should include hidden id field when editing', () => {
			const editingWorkPackage: WorkPackage = {
				id: 'wp-1',
				title: 'Test Work Package',
				description: 'Test description',
				sizeInPersonMonths: 2.5,
				priority: 0,
				assignedTeamId: undefined,
				scheduledPosition: undefined
			};

			const { container } = render(WorkPackageModal, {
				props: {
					optimisticEnhance: mockOptimisticEnhance,
					open: true,
					editingWorkPackage,
					onClose: mockOnClose
				}
			});

			const hiddenIdInput = container.querySelector('input[type="hidden"][name="id"]');
			expect(hiddenIdInput).toBeInTheDocument();
			expect(hiddenIdInput).toHaveValue('wp-1');
		});

		it('should not include hidden id field when creating', () => {
			const { container } = render(WorkPackageModal, {
				props: {
					optimisticEnhance: mockOptimisticEnhance,
					open: true,
					onClose: mockOnClose
				}
			});

			const hiddenIdInput = container.querySelector('input[type="hidden"][name="id"]');
			expect(hiddenIdInput).not.toBeInTheDocument();
		});
	});

	describe('form pre-population', () => {
		it('should pre-populate form fields when editing', () => {
			const editingWorkPackage: WorkPackage = {
				id: 'wp-1',
				title: 'Test Work Package',
				description: 'Test description',
				sizeInPersonMonths: 2.5,
				priority: 0,
				assignedTeamId: undefined,
				scheduledPosition: undefined
			};

			render(WorkPackageModal, {
				props: {
					optimisticEnhance: mockOptimisticEnhance,
					open: true,
					editingWorkPackage,
					onClose: mockOnClose
				}
			});

			const titleInput = screen.getByLabelText('Title') as HTMLInputElement;
			const sizeInput = screen.getByLabelText('Size (person-months)') as HTMLInputElement;
			const descriptionInput = screen.getByLabelText('Description (optional)') as HTMLTextAreaElement;

			expect(titleInput.value).toBe('Test Work Package');
			expect(sizeInput.valueAsNumber).toBe(2.5);
			expect(descriptionInput.value).toBe('Test description');
		});

		it('should have empty form fields when creating', () => {
			render(WorkPackageModal, {
				props: {
					optimisticEnhance: mockOptimisticEnhance,
					open: true,
					onClose: mockOnClose
				}
			});

			const titleInput = screen.getByLabelText('Title') as HTMLInputElement;
			const sizeInput = screen.getByLabelText('Size (person-months)') as HTMLInputElement;
			const descriptionInput = screen.getByLabelText('Description (optional)') as HTMLTextAreaElement;

			expect(titleInput.value).toBe('');
			expect(sizeInput.valueAsNumber).toBe(0);
			expect(descriptionInput.value).toBe('');
		});
	});

	describe('form actions', () => {
		it('should have cancel button', () => {
			render(WorkPackageModal, {
				props: {
					optimisticEnhance: mockOptimisticEnhance,
					open: true,
					onClose: mockOnClose
				}
			});

			expect(screen.getByText('Cancel')).toBeInTheDocument();
		});

		it('should call onClose when cancel button is clicked', async () => {
			render(WorkPackageModal, {
				props: {
					optimisticEnhance: mockOptimisticEnhance,
					open: true,
					onClose: mockOnClose
				}
			});

			const cancelButton = screen.getByText('Cancel');
			await fireEvent.click(cancelButton);

			expect(mockOnClose).toHaveBeenCalledTimes(1);
		});

		it('should show "Add Work Package" button when creating', () => {
			render(WorkPackageModal, {
				props: {
					optimisticEnhance: mockOptimisticEnhance,
					open: true,
					onClose: mockOnClose
				}
			});

			expect(screen.getByRole('button', { name: 'Add Work Package' })).toBeInTheDocument();
		});

		it('should show "Update Work Package" button when editing', () => {
			const editingWorkPackage: WorkPackage = {
				id: 'wp-1',
				title: 'Test Work Package',
				description: 'Test description',
				sizeInPersonMonths: 2.5,
				priority: 0,
				assignedTeamId: undefined,
				scheduledPosition: undefined
			};

			render(WorkPackageModal, {
				props: {
					optimisticEnhance: mockOptimisticEnhance,
					open: true,
					editingWorkPackage,
					onClose: mockOnClose
				}
			});

			expect(screen.getByText('Update Work Package')).toBeInTheDocument();
		});
	});
});
