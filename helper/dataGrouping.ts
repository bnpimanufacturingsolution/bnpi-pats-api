// Helper function to group data by specified field
export const groupDataByField = (
	data: Record<string, unknown>[],
	groupBy: string,
): Record<string, Record<string, unknown>[]> => {
	const grouped: Record<string, Record<string, unknown>[]> = {};

	data.forEach((item) => {
		const groupValue = item[groupBy] || "unassigned";
		const groupKey = String(groupValue);
		if (!grouped[groupKey]) {
			grouped[groupKey] = [];
		}
		grouped[groupKey].push(item);
	});

	return grouped;
};
