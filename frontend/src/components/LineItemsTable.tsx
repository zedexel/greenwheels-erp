import { useRef } from "react";
import { CurrencyCell, ReadOnlyCell } from "@/components/FormSection";
import LinkField from "@/components/LinkField";
import {
	fetchDeliveryItemDetails,
	fetchPurchaseItemDetails,
	recalculateRowAmounts,
	resetLineItemForNewItemCode,
	type LineItemColumn,
	type LineItemRow,
} from "@/lib/master-data";

interface LineItemsTableProps {
	value: LineItemRow[];
	onChange: (rows: LineItemRow[]) => void;
	columns: LineItemColumn[];
	childDoctype: "Purchase Order Item" | "Delivery Note Item";
	disabled?: boolean;
	defaultRow?: Partial<LineItemRow>;
	itemDetailsContext?: Record<string, unknown>;
	referenceDoctype?: string;
	onFieldBlur?: () => void;
}

function rowKey(index: number): string {
	return `row-${index}`;
}

function getReadonlyValue(row: LineItemRow, column: LineItemColumn): string | number | undefined {
	if (column.key === "amount") {
		const withAmounts = recalculateRowAmounts({ ...row });
		return withAmounts.amount;
	}
	return row[column.key as keyof LineItemRow] as string | number | undefined;
}

export default function LineItemsTable({
	value,
	onChange,
	columns,
	childDoctype,
	disabled,
	defaultRow = {},
	itemDetailsContext = {},
	referenceDoctype,
	onFieldBlur,
}: LineItemsTableProps) {
	const valueRef = useRef(value);
	valueRef.current = value;
	const itemFetchRequestRef = useRef<Record<number, number>>({});

	async function updateRow(index: number, key: string, cellValue: unknown) {
		const rows = [...valueRef.current];
		rows[index] = { ...rows[index], [key]: cellValue };

		if (key === "item_code" && cellValue) {
			if (childDoctype === "Purchase Order Item") {
				const company = itemDetailsContext.company as string;
				const supplier = itemDetailsContext.supplier as string;

				if (!company) {
					window.alert("Please select Company first");
					rows[index] = { ...rows[index], item_code: "" };
					onChange(rows);
					return;
				}

				if (!supplier) {
					window.alert("Please select Supplier first");
					rows[index] = { ...rows[index], item_code: "" };
					onChange(rows);
					return;
				}

				const requestId = (itemFetchRequestRef.current[index] || 0) + 1;
				itemFetchRequestRef.current[index] = requestId;

				rows[index] = resetLineItemForNewItemCode(rows[index], String(cellValue));
				onChange(rows);

				const fetched = await fetchPurchaseItemDetails(rows[index], {
					company,
					supplier,
					transactionDate: itemDetailsContext.transactionDate as string,
				});

				if (itemFetchRequestRef.current[index] !== requestId) return;

				const latestRows = [...valueRef.current];
				latestRows[index] = fetched;
				onChange(latestRows);
				return;
			} else {
				const company = itemDetailsContext.company as string;
				const customer = itemDetailsContext.customer as string;

				if (!company) {
					window.alert("Please select Company first");
					rows[index] = { ...rows[index], item_code: "" };
					onChange(rows);
					return;
				}

				if (!customer) {
					window.alert("Please select Customer first");
					rows[index] = { ...rows[index], item_code: "" };
					onChange(rows);
					return;
				}

				const requestId = (itemFetchRequestRef.current[index] || 0) + 1;
				itemFetchRequestRef.current[index] = requestId;

				rows[index] = resetLineItemForNewItemCode(rows[index], String(cellValue));
				onChange(rows);

				const fetched = await fetchDeliveryItemDetails(rows[index], {
					company,
					customer,
					postingDate: itemDetailsContext.postingDate as string,
				});

				if (itemFetchRequestRef.current[index] !== requestId) return;

				const latestRows = [...valueRef.current];
				latestRows[index] = fetched;
				onChange(latestRows);
				return;
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
											{column.type === "readonly" ? (
												column.readonlyFormat === "currency" ? (
													<CurrencyCell value={getReadonlyValue(row, column)} />
												) : (
													<ReadOnlyCell value={getReadonlyValue(row, column)} />
												)
											) : column.type === "link" && column.linkDoctype ? (
												<LinkField
													label=""
													doctype={column.linkDoctype}
													value={String(row[column.key as keyof LineItemRow] || "")}
													onChange={(v) => updateRow(index, column.key, v)}
													disabled={disabled}
													filters={column.linkFilters}
													linkQuery={column.linkQuery}
													allowCreate
													returnTo={window.location.pathname}
													referenceDoctype={referenceDoctype}
													dropdownPlacement="above"
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
													onBlur={
														column.type === "number" && onFieldBlur
															? () => onFieldBlur()
															: undefined
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
					Add Row
				</button>
			)}
		</div>
	);
}
