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

	/**
	 * Get the current month as a YearMonth
	 */
	static current(): YearMonth {
		return YearMonth.fromDate(new Date());
	}

	/**
	 * Check if a string is a valid YearMonth format (YYYY-MM with month 1-12)
	 */
	static isValid(str: string): boolean {
		const match = str.match(/^(\d{4})-(\d{2})$/);
		if (!match) return false;
		const month = parseInt(match[2], 10);
		return month >= 1 && month <= 12;
	}

	/**
	 * Try to parse a string as YearMonth, returning null if invalid
	 */
	static tryParse(str: string): YearMonth | null {
		try {
			return YearMonth.parse(str);
		} catch {
			return null;
		}
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

	/**
	 * Get the next N months starting from this month (inclusive)
	 */
	next(count: number): YearMonth[] {
		const result: YearMonth[] = [];
		for (let i = 0; i < count; i++) {
			result.push(this.addMonths(i));
		}
		return result;
	}

	/**
	 * Get all months from this month to the end month (inclusive)
	 */
	rangeTo(end: YearMonth): YearMonth[] {
		const result: YearMonth[] = [];
		let current: YearMonth = this;
		while (current.compareTo(end) <= 0) {
			result.push(current);
			current = current.addMonths(1);
		}
		return result;
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
