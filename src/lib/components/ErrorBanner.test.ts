import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ErrorBanner from './ErrorBanner.svelte';

describe('ErrorBanner', () => {
	describe('error display', () => {
		it('should display error message', () => {
			render(ErrorBanner, { props: { message: 'Something went wrong' } });
			
			expect(screen.getByText('Something went wrong')).toBeInTheDocument();
		});

		it('should display dismiss button when onDismiss is provided', () => {
			const onDismiss = vi.fn();
			render(ErrorBanner, { props: { message: 'Error', onDismiss } });
			
			const dismissButton = screen.getByRole('button', { name: /dismiss/i });
			expect(dismissButton).toBeInTheDocument();
		});

		it('should call onDismiss when dismiss button is clicked', async () => {
			const onDismiss = vi.fn();
			render(ErrorBanner, { props: { message: 'Error', onDismiss } });
			
			const dismissButton = screen.getByRole('button', { name: /dismiss/i });
			await fireEvent.click(dismissButton);
			
			expect(onDismiss).toHaveBeenCalledTimes(1);
		});

		it('should display retry button when onRetry is provided', () => {
			const onRetry = vi.fn();
			render(ErrorBanner, { props: { message: 'Error', onRetry } });
			
			const retryButton = screen.getByRole('button', { name: /retry/i });
			expect(retryButton).toBeInTheDocument();
		});

		it('should call onRetry when retry button is clicked', async () => {
			const onRetry = vi.fn();
			render(ErrorBanner, { props: { message: 'Error', onRetry } });
			
			const retryButton = screen.getByRole('button', { name: /retry/i });
			await fireEvent.click(retryButton);
			
			expect(onRetry).toHaveBeenCalledTimes(1);
		});

		it('should display both retry and dismiss buttons when both callbacks are provided', () => {
			const onRetry = vi.fn();
			const onDismiss = vi.fn();
			render(ErrorBanner, { props: { message: 'Error', onRetry, onDismiss } });
			
			expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
		});

		it('should not display buttons when no callbacks are provided', () => {
			render(ErrorBanner, { props: { message: 'Error' } });
			
			expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
			expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument();
		});
	});
});
