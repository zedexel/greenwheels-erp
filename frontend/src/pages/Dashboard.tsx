import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import KpiGrid from "@/components/dashboard/KpiGrid";
import MonthRangeFilter from "@/components/dashboard/MonthRangeFilter";
import SupplierActivityTable from "@/components/dashboard/SupplierActivityTable";
import TopPerformersTable from "@/components/dashboard/TopPerformersTable";
import TrendChart from "@/components/dashboard/TrendChart";
import { ValidationBanner } from "@/components/FormSection";
import { useFrappeMethod } from "@/hooks/useFrappeMethod";
import type { DashboardAnalytics } from "@/lib/dashboard";
import { getCurrentYearMonth, getMonthRange } from "@/lib/dashboard";
import { statusClass, statusLabel, type MasterDataRow } from "@/lib/utils";

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
			<div className="mt-2 text-3xl font-semibold text-gray-900">
				{loading ? <span className="text-gray-300">—</span> : value}
			</div>
		</div>
	);
}

export default function Dashboard() {
	const [yearMonth, setYearMonth] = useState(getCurrentYearMonth);
	const [fromDate, setFromDate] = useState(() => getMonthRange(getCurrentYearMonth()).from_date);
	const [toDate, setToDate] = useState(() => getMonthRange(getCurrentYearMonth()).to_date);

	const { data: recent, isLoading: recentLoading } = useFrappeMethod<MasterDataRow[]>(
		"frappe.client.get_list",
		{
			doctype: "Master Data",
			fields: ["name", "project", "project_name", "company", "docstatus", "modified"],
			order_by: "modified desc",
			limit_page_length: 5,
		},
		"dashboard-recent-master-data",
	);

	const { data: totalCount, isLoading: totalLoading } = useFrappeMethod<number>(
		"frappe.client.get_count",
		{ doctype: "Master Data" },
		"dashboard-total-count",
	);

	const { data: draftCount, isLoading: draftLoading } = useFrappeMethod<number>(
		"frappe.client.get_count",
		{
			doctype: "Master Data",
			filters: [["docstatus", "=", 0]],
		},
		"dashboard-draft-count",
	);

	const { data: submittedCount, isLoading: submittedLoading } = useFrappeMethod<number>(
		"frappe.client.get_count",
		{
			doctype: "Master Data",
			filters: [["docstatus", "=", 1]],
		},
		"dashboard-submitted-count",
	);

	const analyticsParams = useMemo(
		() => ({
			from_date: fromDate,
			to_date: toDate,
		}),
		[fromDate, toDate],
	);

	const {
		data: analytics,
		isLoading: analyticsLoading,
		error: analyticsError,
	} = useFrappeMethod<DashboardAnalytics>(
		"greenwheels.api.dashboard.get_dashboard_analytics",
		analyticsParams,
		`dashboard-analytics-${fromDate}-${toDate}`,
	);

	useEffect(() => {
		const range = getMonthRange(yearMonth);
		setFromDate(range.from_date);
		setToDate(range.to_date);
	}, [yearMonth]);

	const recentRows = Array.isArray(recent) ? recent : [];

	const handleFromDateChange = (value: string) => {
		setFromDate(value);
		if (value.slice(0, 7) === toDate.slice(0, 7)) {
			setYearMonth(value.slice(0, 7));
		}
	};

	const handleToDateChange = (value: string) => {
		setToDate(value);
		if (fromDate.slice(0, 7) === value.slice(0, 7)) {
			setYearMonth(value.slice(0, 7));
		}
	};

	return (
		<div className="space-y-6">
			<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				<StatCard label="Total Records" value={totalCount ?? 0} loading={totalLoading} />
				<StatCard label="Draft" value={draftCount ?? 0} loading={draftLoading} />
				<StatCard
					label="Submitted"
					value={submittedCount ?? 0}
					loading={submittedLoading}
				/>
				<StatCard label="Welcome" value="Green Wheels" />
			</div>

			<MonthRangeFilter
				yearMonth={yearMonth}
				fromDate={fromDate}
				toDate={toDate}
				onYearMonthChange={setYearMonth}
				onFromDateChange={handleFromDateChange}
				onToDateChange={handleToDateChange}
			/>

			{analyticsError ? <ValidationBanner errors={[analyticsError]} /> : null}

			<KpiGrid summary={analytics?.summary ?? null} loading={analyticsLoading} />

			<TrendChart data={analytics?.monthly_trend ?? []} loading={analyticsLoading} />

			<div className="grid gap-6 lg:grid-cols-2">
				<TopPerformersTable
					title="Top Taxi Suppliers"
					emptyMessage="No taxi supplier activity in this period."
					nameHeader="Supplier"
					countHeader="Orders"
					amountHeader="Taxi Spend"
					loading={analyticsLoading}
					rows={(analytics?.top_taxi_suppliers ?? []).map((row) => ({
						key: row.supplier,
						name: row.supplier_name,
						count: row.order_count,
						amount: row.total_amount,
					}))}
				/>
				<TopPerformersTable
					title="Top Crusher Suppliers"
					emptyMessage="No crusher supplier activity in this period."
					nameHeader="Supplier"
					countHeader="Orders"
					amountHeader="Crusher Spend"
					loading={analyticsLoading}
					rows={(analytics?.top_crusher_suppliers ?? []).map((row) => ({
						key: row.supplier,
						name: row.supplier_name,
						count: row.order_count,
						amount: row.total_amount,
					}))}
				/>
				<TopPerformersTable
					title="Top Projects"
					emptyMessage="No project activity in this period."
					nameHeader="Project"
					countHeader="Transactions"
					amountHeader="Sales"
					loading={analyticsLoading}
					rows={(analytics?.top_projects ?? []).map((row) => ({
						key: row.project,
						name: row.project_name,
						count: row.transaction_count,
						amount: row.sales_total,
					}))}
				/>
				<TopPerformersTable
					title="Top Customers"
					emptyMessage="No customer deliveries in this period."
					nameHeader="Customer"
					countHeader="Deliveries"
					amountHeader="Sales"
					loading={analyticsLoading}
					rows={(analytics?.top_customers ?? []).map((row) => ({
						key: row.customer,
						name: row.customer_name,
						count: row.delivery_count,
						amount: row.sales_total,
					}))}
				/>
			</div>

			<SupplierActivityTable
				rows={analytics?.supplier_activity ?? []}
				loading={analyticsLoading}
			/>

			<div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
				<h2 className="text-base font-semibold text-gray-900">Welcome back</h2>
				<p className="mt-2 max-w-2xl text-sm text-gray-600">
					Use the sidebar to open Master Data and manage project records, purchase orders,
					and delivery orders from one place.
				</p>
				<div className="mt-5">
					<Link
						to="/master-data"
						className="inline-flex rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-800"
					>
						Go to Master Data
					</Link>
				</div>
			</div>

			<div className="rounded-xl border border-gray-200 bg-white shadow-sm">
				<div className="border-b border-gray-200 px-6 py-4">
					<h2 className="text-base font-semibold text-gray-900">Recent Master Data</h2>
				</div>
				{recentLoading ? (
					<div className="px-6 py-8 text-sm text-gray-500">Loading recent records...</div>
				) : !recentRows.length ? (
					<div className="px-6 py-8 text-sm text-gray-500">No master data records yet.</div>
				) : (
					<div className="divide-y divide-gray-100">
						{recentRows.map((row) => (
							<Link
								key={row.name}
								to={`/master-data/${encodeURIComponent(row.name)}`}
								className="flex items-center justify-between px-6 py-4 transition hover:bg-gray-50"
							>
								<div>
									<div className="font-medium text-gray-900">{row.name}</div>
									<div className="text-sm text-gray-500">
										{row.project_name || row.project || "No project"}
									</div>
								</div>
								<span
									className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass(row.docstatus)}`}
								>
									{statusLabel(row.docstatus)}
								</span>
							</Link>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
