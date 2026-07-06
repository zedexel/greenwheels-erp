import type { DashboardSummary } from "@/lib/dashboard";
import { formatCurrency } from "@/lib/utils";

function StatCard({
	label,
	value,
	loading,
}: {
	label: string;
	value: string | number;
	loading?: boolean;
}) {
	return (
		<div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
			<div className="text-sm font-medium text-gray-500">{label}</div>
			<div className="mt-2 text-2xl font-semibold text-gray-900">
				{loading ? <span className="text-gray-300">—</span> : value}
			</div>
		</div>
	);
}

interface KpiGridProps {
	summary: DashboardSummary | null;
	loading?: boolean;
}

export default function KpiGrid({ summary, loading }: KpiGridProps) {
	const activeSuppliers =
		(summary?.unique_taxi_suppliers ?? 0) + (summary?.unique_crusher_suppliers ?? 0);

	return (
		<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
			<StatCard
				label="Transactions"
				value={summary?.transaction_count ?? 0}
				loading={loading}
			/>
			<StatCard
				label="Sales (Deliveries)"
				value={formatCurrency(summary?.sales_total ?? 0)}
				loading={loading}
			/>
			<StatCard
				label="Purchase Spend"
				value={formatCurrency(summary?.purchase_total ?? 0)}
				loading={loading}
			/>
			<StatCard label="Active Suppliers" value={activeSuppliers} loading={loading} />
			<StatCard label="Projects" value={summary?.unique_projects ?? 0} loading={loading} />
			<StatCard label="Customers" value={summary?.unique_customers ?? 0} loading={loading} />
		</div>
	);
}
