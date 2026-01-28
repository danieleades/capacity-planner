export const TEAM_COLORS = [
	{ bg: 'bg-blue-500', light: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-800' },
	{ bg: 'bg-green-500', light: 'bg-green-100', border: 'border-green-300', text: 'text-green-800' },
	{ bg: 'bg-purple-500', light: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-800' },
	{ bg: 'bg-orange-500', light: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-800' },
	{ bg: 'bg-pink-500', light: 'bg-pink-100', border: 'border-pink-300', text: 'text-pink-800' },
	{ bg: 'bg-teal-500', light: 'bg-teal-100', border: 'border-teal-300', text: 'text-teal-800' }
] as const;

function hashString(value: string): number {
	let hash = 0;
	for (let i = 0; i < value.length; i++) {
		hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
	}
	return hash;
}

export function getTeamColor(name: string) {
	if (!name) return TEAM_COLORS[0];
	const index = hashString(name) % TEAM_COLORS.length;
	return TEAM_COLORS[index];
}
