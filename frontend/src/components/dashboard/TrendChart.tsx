import {
	Bar,
	CartesianGrid,
	ComposedChart,
	Legend,
	Line,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import type { MonthlyTrendRow } from "@/lib/dashboard";
import { formatCurrency, formatMonthLabel } from "@/lib/utils";

interface TrendChartProps {
	data: MonthlyTrendRow[];
	loading?: boolean;
}

export default function TrendChart({ data, loading }: TrendChartProps) {
	const chartData = data.map((row) => ({
		...row,
		label: formatMonthLabel(row.month),
	}));

	return (
		<div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
			<div className="mb-4">
				<h2 className="text-base font-semibold text-gray-900">12-Month Trend</h2>
				<p className="mt-1 text-sm text-gray-500">
					Monthly transactions and sales ending at the selected period.
				</p>
			</div>
			{loading ? (
				<div className="flex h-72 items-center justify-center text-sm text-gray-500">
					Loading trend data...
				</div>
			) : !chartData.length ? (
				<div className="flex h-72 items-center justify-center text-sm text-gray-500">
					No submitted records in this trend window.
				</div>
			) : (
				<div className="h-72">
					<ResponsiveContainer width="100%" height="100%">
						<ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
							<CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
							<XAxis dataKey="label" tick={{ fontSize: 12 }} />
							<YAxis
								yAxisId="left"
								allowDecimals={false}
								tick={{ fontSize: 12 }}
								label={{ value: "Transactions", angle: -90, position: "insideLeft" }}
							/>
							<YAxis
								yAxisId="right"
								orientation="right"
								tick={{ fontSize: 12 }}
								tickFormatter={(value) =>
									new Intl.NumberFormat(undefined, {
										notation: "compact",
										maximumFractionDigits: 1,
									}).format(value)
								}
							/>
							<Tooltip
								formatter={(value, name) => {
									if (name === "Sales") {
										return [formatCurrency(Number(value)), name];
									}
									return [value, name];
								}}
							/>
							<Legend />
							<Bar
								yAxisId="left"
								dataKey="transactions"
								name="Transactions"
								fill="#047857"
								radius={[4, 4, 0, 0]}
							/>
							<Line
								yAxisId="right"
								type="monotone"
								dataKey="sales_total"
								name="Sales"
								stroke="#2563eb"
								strokeWidth={2}
								dot={{ r: 3 }}
							/>
						</ComposedChart>
					</ResponsiveContainer>
				</div>
			)}
		</div>
	);
}
