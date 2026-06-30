import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useFrappeMethod } from "@/hooks/useFrappeMethod";
import { getMasterConfigByKey } from "@/config/masters";

export default function MasterEntityList() {
	const { entityKey } = useParams<{ entityKey: string }>();
	const navigate = useNavigate();
	const [search, setSearch] = useState("");

	const config = getMasterConfigByKey(entityKey || "");
	if (!config) {
		return (
			<div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-500">
				Unknown master type.
			</div>
		);
	}

	const { data, isLoading } = useFrappeMethod<Record<string, string>[]>(
		"frappe.client.get_list",
		{
			doctype: config.doctype,
			fields: config.listColumns.map((col) => col.key),
			order_by: "modified desc",
			limit_page_length: 100,
		},
		`master-list-${config.key}`,
	);

	const filteredRows = useMemo(() => {
		const rows = Array.isArray(data) ? data : [];
		const query = search.trim().toLowerCase();
		if (!query) return rows;
		return rows.filter((row) =>
			config.listColumns.some((col) =>
				String(row[col.key] || "")
					.toLowerCase()
					.includes(query),
			),
		);
	}, [data, search, config.listColumns]);

	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="relative w-full max-w-sm">
					<input
						type="text"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder={`Search ${config.labelPlural.toLowerCase()}...`}
						className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
					/>
				</div>
				<Link
					to={config.createRoute}
					className="inline-flex items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-800"
				>
					+ New {config.label}
				</Link>
			</div>

			<div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
				{isLoading ? (
					<div className="px-6 py-10 text-center text-sm text-gray-500">Loading...</div>
				) : !filteredRows.length ? (
					<div className="px-6 py-10 text-center text-sm text-gray-500">
						No {config.labelPlural.toLowerCase()} found.
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="min-w-full divide-y divide-gray-200">
							<thead className="bg-gray-50">
								<tr>
									{config.listColumns.map((column) => (
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
											navigate(
												`${config.listRoute}/${encodeURIComponent(row.name)}`,
											)
										}
									>
										{config.listColumns.map((column) => (
											<td key={column.key} className="px-4 py-3 text-sm text-gray-700">
												{row[column.key] || "—"}
											</td>
										))}
										<td className="px-4 py-3 text-right">
											<button
												type="button"
												className="rounded-lg px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
												onClick={(e) => {
													e.stopPropagation();
													navigate(
														`${config.listRoute}/${encodeURIComponent(row.name)}`,
													);
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
