import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useFrappeMethod } from "@/hooks/useFrappeMethod";
import { formatDate, statusClass, statusLabel, type MasterDataRow } from "@/lib/utils";

const columns = [
	{ key: "name", label: "ID" },
	{ key: "project", label: "Project" },
	{ key: "company", label: "Company" },
	{ key: "status", label: "Status" },
	{ key: "modified", label: "Modified" },
];

export default function MasterDataList() {
	const navigate = useNavigate();
	const [search, setSearch] = useState("");

	const { data, isLoading } = useFrappeMethod<MasterDataRow[]>(
		"frappe.client.get_list",
		{
			doctype: "Master Data",
			fields: ["name", "project", "project_name", "company", "docstatus", "modified"],
			order_by: "modified desc",
			limit_page_length: 100,
		},
		"master-data-list",
	);

	const filteredRows = useMemo(() => {
		const rows = Array.isArray(data) ? data : [];
		const query = search.trim().toLowerCase();
		if (!query) return rows;
		return rows.filter((row) =>
			[row.name, row.project, row.project_name, row.company]
				.filter(Boolean)
				.some((value) => String(value).toLowerCase().includes(query)),
		);
	}, [data, search]);

	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="relative w-full max-w-sm">
					<input
						type="text"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search by name or project..."
						className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
					/>
				</div>
				<Link
					to="/master-data/create"
					className="inline-flex items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-800"
				>
					+ New Master Data
				</Link>
			</div>

			<div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
				{isLoading ? (
					<div className="px-6 py-10 text-center text-sm text-gray-500">
						Loading master data...
					</div>
				) : !filteredRows.length ? (
					<div className="px-6 py-10 text-center text-sm text-gray-500">
						No master data records found.
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="min-w-full divide-y divide-gray-200">
							<thead className="bg-gray-50">
								<tr>
									{columns.map((column) => (
										<th
											key={column.key}
											className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
										>
											{column.label}
										</th>
									))}
									<th className="px-4 py-3" />
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-100 bg-white">
								{filteredRows.map((row) => (
									<tr
										key={row.name}
										className="cursor-pointer transition hover:bg-gray-50"
										onClick={() =>
											navigate(`/master-data/${encodeURIComponent(row.name)}`)
										}
									>
										<td className="px-4 py-3 text-sm font-medium text-gray-900">
											{row.name}
										</td>
										<td className="px-4 py-3 text-sm text-gray-700">
											{row.project_name || row.project || "—"}
										</td>
										<td className="px-4 py-3 text-sm text-gray-700">
											{row.company || "—"}
										</td>
										<td className="px-4 py-3 text-sm text-gray-700">
											<span
												className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass(row.docstatus)}`}
											>
												{statusLabel(row.docstatus)}
											</span>
										</td>
										<td className="px-4 py-3 text-sm text-gray-500">
											{formatDate(row.modified)}
										</td>
										<td className="px-4 py-3 text-right">
											<button
												type="button"
												className="rounded-lg px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
												onClick={(e) => {
													e.stopPropagation();
													navigate(`/master-data/${encodeURIComponent(row.name)}`);
												}}
											>
												Open
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
}
