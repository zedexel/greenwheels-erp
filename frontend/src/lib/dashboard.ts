import { frappeCall } from "@/lib/frappe-api";

export interface DashboardSummary {
	transaction_count: number;
	sales_total: number;
	purchase_total: number;
	unique_taxi_suppliers: number;
	unique_crusher_suppliers: number;
	unique_projects: number;
	unique_customers: number;
}

export interface MonthlyTrendRow {
	month: string;
	transactions: number;
	sales_total: number;
	purchase_total: number;
	active_suppliers: number;
}

export interface TopSupplierRow {
	supplier: string;
	supplier_name: string;
	order_count: number;
	total_amount: number;
}

export interface TopProjectRow {
	project: string;
	project_name: string;
	transaction_count: number;
	sales_total: number;
}

export interface TopCustomerRow {
	customer: string;
	customer_name: string;
	delivery_count: number;
	sales_total: number;
}

export interface SupplierActivityRow {
	supplier: string;
	supplier_name: string;
	role: "Taxi" | "Crusher";
	project_count: number;
	total_amount: number;
}

export interface DashboardAnalytics {
	summary: DashboardSummary;
	monthly_trend: MonthlyTrendRow[];
	top_taxi_suppliers: TopSupplierRow[];
	top_crusher_suppliers: TopSupplierRow[];
	top_projects: TopProjectRow[];
	top_customers: TopCustomerRow[];
	supplier_activity: SupplierActivityRow[];
}

export function getCurrentYearMonth(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	return `${year}-${month}`;
}

export function getMonthRange(yearMonth: string): { from_date: string; to_date: string } {
	const [year, month] = yearMonth.split("-").map(Number);
	const fromDate = new Date(year, month - 1, 1);
	const toDate = new Date(year, month, 0);
	const format = (date: Date) =>
		`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

	return {
		from_date: format(fromDate),
		to_date: format(toDate),
	};
}

export async function getDashboardAnalytics(
	fromDate: string,
	toDate: string,
): Promise<DashboardAnalytics> {
	return frappeCall<DashboardAnalytics>("greenwheels.api.dashboard.get_dashboard_analytics", {
		from_date: fromDate,
		to_date: toDate,
	});
}
