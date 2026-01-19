/**
 * Immutable value class representing a year-month (e.g., "2025-02").
 */
export class YearMonth {
	readonly year: number;
	readonly month: number; // 1-12

	constructor(year: number, month: number) {
		if (!Number.isInteger(year)) {
			throw new Error(`Year must be an integer, got: ${year}`);
		}
		if (!Number.isInteger(month) || month < 1 || month > 12) {
			throw new Error(`Month must be an integer between 1-12, got: ${month}`);
		}
		this.year = year;
		this.month = month;
	}

	static fromDate(date: Date): YearMonth {
		return new YearMonth(date.getFullYear(), date.getMonth() + 1);
	}

	static parse(str: string): YearMonth {
		const match = str.match(/^(\d{4})-(\d{2})$/);
		if (!match) {
			throw new Error(`Invalid YearMonth format: "${str}". Expected "YYYY-MM".`);
		}
		return new YearMonth(parseInt(match[1], 10), parseInt(match[2], 10));
	}

	toString(): string {
		return `${this.year}-${String(this.month).padStart(2, '0')}`;
	}

	toDate(): Date {
		return new Date(this.year, this.month - 1, 1);
	}

	format(): string {
		return this.toDate().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
	}

	daysInMonth(): number {
		return new Date(this.year, this.month, 0).getDate();
	}

	addMonths(n: number): YearMonth {
		const date = new Date(this.year, this.month - 1 + n, 1);
		return YearMonth.fromDate(date);
	}

	compareTo(other: YearMonth): number {
		if (this.year !== other.year) {
			return this.year - other.year;
		}
		return this.month - other.month;
	}

	toJSON(): string {
		return this.toString();
	}
}
