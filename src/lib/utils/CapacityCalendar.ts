import { YearMonth, type Team } from '$lib/types';
import { getCapacityForMonth } from './capacity';

/**
 * A calendar-based iterator for consuming team capacity month-by-month.
 * Encapsulates the month-by-month iteration logic used in capacity simulations.
 */
export class CapacityCalendar {
	private currentMonth: YearMonth;
	private fractionConsumedInMonth: number = 0;
	private monthsProcessed: number = 0;
	private readonly maxMonths: number;

	constructor(
		private readonly team: Team,
		startDate: Date,
		maxMonths: number = 240
	) {
		this.currentMonth = YearMonth.fromDate(startDate);
		this.maxMonths = maxMonths;
	}

	/**
	 * Get the current position as a Date (precise to the day based on fraction consumed)
	 */
	toDate(): Date {
		const daysInMonth = this.currentMonth.daysInMonth();
		const day = Math.max(1, Math.min(Math.ceil(this.fractionConsumedInMonth * daysInMonth), daysInMonth));
		return new Date(this.currentMonth.year, this.currentMonth.month - 1, day);
	}

	/**
	 * Get available capacity in the current month (accounting for what's already consumed)
	 */
	getAvailableCapacity(): number {
		const monthCapacity = getCapacityForMonth(this.team, this.currentMonth);
		return monthCapacity * (1 - this.fractionConsumedInMonth);
	}

	/**
	 * Check if the calendar has reached its maximum month limit
	 */
	isExhausted(): boolean {
		return this.monthsProcessed >= this.maxMonths;
	}

	/**
	 * Advance to the next month
	 */
	private advanceMonth(): void {
		this.currentMonth = this.currentMonth.addMonths(1);
		this.fractionConsumedInMonth = 0;
		this.monthsProcessed++;
	}

	/**
	 * Consume work from the calendar, returning how much was consumed and the end date.
	 * The calendar state is updated to reflect the consumed work.
	 */
	consumeWork(amount: number): { consumed: number; endDate: Date } {
		let remaining = amount;

		while (remaining > 0 && !this.isExhausted()) {
			const monthCapacity = getCapacityForMonth(this.team, this.currentMonth);

			// Skip months with zero capacity
			if (monthCapacity <= 0) {
				this.advanceMonth();
				continue;
			}

			const available = this.getAvailableCapacity();

			if (available <= 0) {
				this.advanceMonth();
				continue;
			}

			const workDone = Math.min(remaining, available);
			remaining -= workDone;

			// Update fraction consumed
			const fractionUsed = workDone / monthCapacity;
			this.fractionConsumedInMonth += fractionUsed;

			// If month is fully consumed and more work remains, move to next
			if (this.fractionConsumedInMonth >= 1 - 1e-9 && remaining > 0) {
				this.advanceMonth();
			}
		}

		return {
			consumed: amount - remaining,
			endDate: this.toDate()
		};
	}

	/**
	 * Count how many months (fractional) would be needed to complete the given amount of work,
	 * and return the completion date. Does NOT modify the calendar state.
	 */
	countMonthsForWork(amount: number): { months: number; completionDate: Date | null } {
		if (amount <= 0) {
			return { months: 0, completionDate: null };
		}

		let remaining = amount;
		let monthsWithCapacity = 0;
		let currentMonth = this.currentMonth;
		let monthsProcessed = 0;
		let completionDate: Date | null = null;

		while (remaining > 0 && monthsProcessed < this.maxMonths) {
			const monthCapacity = getCapacityForMonth(this.team, currentMonth);

			if (monthCapacity > 0) {
				const workBefore = remaining;
				remaining -= monthCapacity;

				if (remaining <= 0) {
					// Calculate precise completion
					const fractionOfMonth = workBefore / monthCapacity;
					monthsWithCapacity += fractionOfMonth;

					const daysInMonth = currentMonth.daysInMonth();
					const completionDay = Math.round(fractionOfMonth * daysInMonth);
					const day = Math.max(1, Math.min(completionDay, daysInMonth));
					completionDate = new Date(currentMonth.year, currentMonth.month - 1, day);
					break;
				}

				monthsWithCapacity++;
			}

			currentMonth = currentMonth.addMonths(1);
			monthsProcessed++;
		}

		return {
			months: remaining <= 0 ? monthsWithCapacity : Infinity,
			completionDate
		};
	}
}
