export interface DateRange {
	fromDate: string;
	toDate: string;
}

interface MonthRangeFilterProps {
	yearMonth: string;
	fromDate: string;
	toDate: string;
	onYearMonthChange: (yearMonth: string) => void;
	onFromDateChange: (fromDate: string) => void;
	onToDateChange: (toDate: string) => void;
}

export default function MonthRangeFilter({
	yearMonth,
	fromDate,
	toDate,
	onYearMonthChange,
	onFromDateChange,
	onToDateChange,
}: MonthRangeFilterProps) {
	return (
		<div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
				<div>
					<h2 className="text-base font-semibold text-gray-900">Business Analytics</h2>
					<p className="mt-1 text-sm text-gray-500">
						Submitted Master Data filtered by delivery date.
					</p>
				</div>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-end">
					<label className="flex flex-col gap-1 text-sm">
						<span className="font-medium text-gray-700">Month</span>
						<input
							type="month"
							value={yearMonth}
							onChange={(event) => onYearMonthChange(event.target.value)}
							className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
						/>
					</label>
					<label className="flex flex-col gap-1 text-sm">
						<span className="font-medium text-gray-700">From</span>
						<input
							type="date"
							value={fromDate}
							onChange={(event) => onFromDateChange(event.target.value)}
							className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
						/>
					</label>
					<label className="flex flex-col gap-1 text-sm">
						<span className="font-medium text-gray-700">To</span>
						<input
							type="date"
							value={toDate}
							onChange={(event) => onToDateChange(event.target.value)}
							className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
						/>
					</label>
				</div>
			</div>
		</div>
	);
}
