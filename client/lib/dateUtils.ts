function normalizeAllDates(dateStrings: string[]) {
	const validDates: Date[] = [];

	for (const dateString of dateStrings) {
		const date = parseDateString(dateString);
		if (date) {
			validDates.push(date);
		}
	}

	// Sort dates chronologically
	validDates.sort((a, b) => a.getTime() - b.getTime());

	return {
		normalizedDates: validDates,
		earliestDate: validDates.length > 0 ? validDates[0] : null,
		latestDate:
			validDates.length > 0 ? validDates[validDates.length - 1] : null,
	};
}

function parseDateString(dateString: string): Date | null {
	// Common date formats in the JFK files
	const formats = [
		{
			regex: /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(19\d{2})$/i,
			parse: (m: RegExpMatchArray) =>
				new Date(parseInt(m[3]), getMonthIndex(m[2]), parseInt(m[1])),
		},
		{
			regex: /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(19\d{2})$/i,
			parse: (m: RegExpMatchArray) =>
				new Date(parseInt(m[3]), getMonthIndex(m[1]), parseInt(m[2])),
		},
		{
			regex: /^(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(19\d{2})$/i,
			parse: (m: RegExpMatchArray) =>
				new Date(parseInt(m[3]), getMonthIndex(m[2]), parseInt(m[1])),
		},
		{
			regex: /^(\d{1,2})(?:st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(19\d{2})$/i,
			parse: (m: RegExpMatchArray) =>
				new Date(parseInt(m[3]), getMonthIndex(m[2]), parseInt(m[1])),
		},
		{
			regex: /^(\d{1,2})\/(\d{1,2})\/(19\d{2})$/i,
			parse: (m: RegExpMatchArray) =>
				new Date(parseInt(m[3]), parseInt(m[1]) - 1, parseInt(m[2])),
		},
		{
			regex: /^(19\d{2})-(\d{1,2})-(\d{1,2})$/i,
			parse: (m: RegExpMatchArray) =>
				new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3])),
		},
		{
			regex: /^(19\d{2})$/i,
			parse: (m: RegExpMatchArray) => new Date(parseInt(m[1]), 0, 1),
		}, // Just a year = January 1st of that year
	];

	for (const format of formats) {
		const match = dateString.match(format.regex);
		if (match) {
			try {
				const date = format.parse(match);
				if (isValidDate(date)) {
					return date;
				}
			} catch (e) {
				// Continue to next format
			}
		}
	}

	return null;
}

function getMonthIndex(month: string): number {
	const months: Record<string, number> = {
		jan: 0,
		january: 0,
		feb: 1,
		february: 1,
		mar: 2,
		march: 2,
		apr: 3,
		april: 3,
		may: 4,
		jun: 5,
		june: 5,
		jul: 6,
		july: 6,
		aug: 7,
		august: 7,
		sep: 8,
		september: 8,
		oct: 9,
		october: 9,
		nov: 10,
		november: 10,
		dec: 11,
		december: 11,
	};

	const key = month.toLowerCase();
	return months[key] ?? 0;
}

function isValidDate(date: Date): boolean {
	return !isNaN(date.getTime());
}

module.exports = {
	normalizeAllDates,
	parseDateString,
};
