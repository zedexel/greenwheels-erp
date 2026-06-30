import {
	fetchDeliveryItemDetails,
	fetchPurchaseItemDetails,
	recalculateRowAmounts,
	type LineItemRow,
} from "@/lib/master-data";
import LinkField from "@/components/LinkField";

export interface LineItemColumn {
	key: string;
	label: string;
	type: "link" | "number" | "date" | "text";
	linkDoctype?: string;
	placeholder?: string;
}

interface LineItemsTableProps {
	value: LineItemRow[];
	onChange: (rows: LineItemRow[]) => void;
	columns: LineItemColumn[];
	childDoctype: "Purchase Order Item" | "Delivery Note Item";
	disabled?: boolean;
	defaultRow?: Partial<LineItemRow>;
	itemDetailsContext?: Record<string, unknown>;
}

function rowKey(index: number): string {
	return `row-${index}`;
}

export default function LineItemsTable({
	value,
	onChange,
	columns,
	childDoctype,
	disabled,
	defaultRow = {},
	itemDetailsContext = {},
}: LineItemsTableProps) {
	async function updateRow(index: number, key: string, cellValue: unknown) {
		const rows = [...value];
		rows[index] = { ...rows[index], [key]: cellValue };

		if (key === "item_code" && cellValue) {
			if (childDoctype === "Purchase Order Item") {
				rows[index] = await fetchPurchaseItemDetails(rows[index], {
					company: itemDetailsContext.company as string,
					supplier: itemDetailsContext.supplier as string,
					transactionDate: itemDetailsContext.transactionDate as string,
				});
			} else {
				rows[index] = await fetchDeliveryItemDetails(rows[index], {
					company: itemDetailsContext.company as string,
					customer: itemDetailsContext.customer as string,
					postingDate: itemDetailsContext.postingDate as string,
				});
			}
		} else if (key === "qty" || key === "rate") {
			rows[index] = recalculateRowAmounts(rows[index]);
		}

		onChange(rows);
	}

	function addRow() {
		onChange([...value, { ...defaultRow, doctype: childDoctype }]);
	}

	function removeRow(index: number) {
		onChange(value.filter((_, i) => i !== index));
	}

	return (
		<div className="space-y-3">
			<div className="overflow-x-auto rounded-lg border border-gray-200">
				<table className="min-w-full divide-y divide-gray-200 text-sm">
					<thead className="bg-gray-50">
						<tr>
							{columns.map((column) => (
								<th
									key={column.key}
									className="px-3 py-2 text-left font-medium text-gray-600"
								>
									{column.label}
								</th>
							))}
							<th className="px-3 py-2" />
						</tr>
					</thead>
					<tbody className="divide-y divide-gray-100 bg-white">
						{!value.length ? (
							<tr>
								<td
									colSpan={columns.length + 1}
									className="px-3 py-6 text-center text-gray-500"
								>
									No items added yet.
								</td>
							</tr>
						) : (
							value.map((row, index) => (
								<tr key={rowKey(index)}>
									{columns.map((column) => (
										<td key={column.key} className="px-3 py-2 align-top">
											{column.type === "link" && column.linkDoctype ? (
												<LinkField
													label=""
													doctype={column.linkDoctype}
													value={String(row[column.key as keyof LineItemRow] || "")}
													onChange={(v) => updateRow(index, column.key, v)}
													disabled={disabled}
													placeholder={column.placeholder || "Select"}
													allowCreate
													returnTo={window.location.pathname}
												/>
											) : (
												<input
													type={column.type === "number" ? "number" : column.type}
													value={String(row[column.key as keyof LineItemRow] ?? "")}
													disabled={disabled}
													className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-50"
													onChange={(e) =>
														updateRow(index, column.key, e.target.value)
													}
												/>
											)}
										</td>
									))}
									<td className="px-3 py-2 align-top">
										{!disabled && (
											<button
												type="button"
												className="text-sm text-red-600 hover:underline"
												onClick={() => removeRow(index)}
											>
												Remove
											</button>
										)}
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>
			{!disabled && (
				<button
					type="button"
					className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
					onClick={addRow}
				>
					+ Add row
				</button>
			)}
		</div>
	);
}
