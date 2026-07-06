import type { SupplierActivityRow } from "@/lib/dashboard";
import { formatCurrency } from "@/lib/utils";

interface SupplierActivityTableProps {
	rows: SupplierActivityRow[];
	loading?: boolean;
}

export default function SupplierActivityTable({ rows, loading }: SupplierActivityTableProps) {
	return (
		<div className="rounded-xl border border-gray-200 bg-white shadow-sm">
			<div className="border-b border-gray-200 px-6 py-4">
				<h2 className="text-base font-semibold text-gray-900">Supplier Activity</h2>
				<p className="mt-1 text-sm text-gray-500">
					Taxi and crusher suppliers with work in the selected period.
				</p>
			</div>
			{loading ? (
				<div className="px-6 py-8 text-sm text-gray-500">Loading supplier activity...</div>
			) : !rows.length ? (
				<div className="px-6 py-8 text-sm text-gray-500">
					No supplier activity in this period.
				</div>
			) : (
				<div className="overflow-x-auto">
					<table className="min-w-full divide-y divide-gray-100">
						<thead className="bg-gray-50">
							<tr>
								<th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
									Supplier
								</th>
								<th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
									Role
								</th>
								<th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
									Orders
								</th>
								<th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
									Amount
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-100 bg-white">
							{rows.map((row) => (
								<tr key={`${row.supplier}-${row.role}`}>
									<td className="px-6 py-4 text-sm font-medium text-gray-900">
										{row.supplier_name}
									</td>
									<td className="px-6 py-4 text-sm text-gray-600">{row.role}</td>
									<td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-700">
										{row.project_count}
									</td>
									<td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-700">
										{formatCurrency(row.total_amount)}
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
