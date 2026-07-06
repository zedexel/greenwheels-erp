import { formatCurrency } from "@/lib/utils";

interface TopPerformersTableProps {
	title: string;
	emptyMessage: string;
	nameHeader: string;
	countHeader: string;
	amountHeader: string;
	rows: Array<{
		key: string;
		name: string;
		count: number;
		amount: number;
	}>;
	loading?: boolean;
}

export default function TopPerformersTable({
	title,
	emptyMessage,
	nameHeader,
	countHeader,
	amountHeader,
	rows,
	loading,
}: TopPerformersTableProps) {
	return (
		<div className="rounded-xl border border-gray-200 bg-white shadow-sm">
			<div className="border-b border-gray-200 px-6 py-4">
				<h2 className="text-base font-semibold text-gray-900">{title}</h2>
			</div>
			{loading ? (
				<div className="px-6 py-8 text-sm text-gray-500">Loading...</div>
			) : !rows.length ? (
				<div className="px-6 py-8 text-sm text-gray-500">{emptyMessage}</div>
			) : (
				<div className="overflow-x-auto">
					<table className="min-w-full divide-y divide-gray-100">
						<thead className="bg-gray-50">
							<tr>
								<th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
									Rank
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
									{nameHeader}
								</th>
								<th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
									{countHeader}
								</th>
								<th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
									{amountHeader}
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-100 bg-white">
							{rows.map((row, index) => (
								<tr key={row.key}>
									<td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
										{index + 1}
									</td>
									<td className="px-6 py-4 text-sm font-medium text-gray-900">{row.name}</td>
									<td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-700">
										{row.count}
									</td>
									<td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-700">
										{formatCurrency(row.amount)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
