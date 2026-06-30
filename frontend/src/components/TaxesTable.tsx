import LinkField from "@/components/LinkField";
import type { TaxRow } from "@/lib/master-data";

interface TaxesTableProps {
	value: TaxRow[];
	onChange: (rows: TaxRow[]) => void;
	disabled?: boolean;
	showPettyCash?: boolean;
	parentfield: string;
}

const CHARGE_TYPES = ["On Net Total", "Actual", "On Previous Row Amount", "On Previous Row Total"];

export default function TaxesTable({
	value,
	onChange,
	disabled,
	showPettyCash,
	parentfield,
}: TaxesTableProps) {
	function updateRow(index: number, key: string, cellValue: unknown) {
		const rows = [...value];
		rows[index] = { ...rows[index], [key]: cellValue };
		onChange(rows);
	}

	function addRow() {
		onChange([
			...value,
			{
				doctype: parentfield.includes("taxi") || parentfield.includes("crusher")
					? "Purchase Taxes and Charges"
					: "Sales Taxes and Charges",
				parentfield,
				charge_type: "On Net Total",
			},
		]);
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
							<th className="px-3 py-2 text-left font-medium text-gray-600">Type</th>
							<th className="px-3 py-2 text-left font-medium text-gray-600">
								Account Head
							</th>
							<th className="px-3 py-2 text-left font-medium text-gray-600">
								Description
							</th>
							<th className="px-3 py-2 text-left font-medium text-gray-600">Rate %</th>
							<th className="px-3 py-2 text-left font-medium text-gray-600">
								Tax Amount
							</th>
							{showPettyCash && (
								<th className="px-3 py-2 text-left font-medium text-gray-600">
									Petty Cash
								</th>
							)}
							<th className="px-3 py-2" />
						</tr>
					</thead>
					<tbody className="divide-y divide-gray-100 bg-white">
						{!value.length ? (
							<tr>
								<td
									colSpan={showPettyCash ? 7 : 6}
									className="px-3 py-6 text-center text-gray-500"
								>
									No taxes added yet.
								</td>
							</tr>
						) : (
							value.map((row, index) => (
								<tr key={`tax-${index}`}>
									<td className="px-3 py-2 align-top">
										<select
											value={row.charge_type || "On Net Total"}
											disabled={disabled}
											className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-50"
											onChange={(e) => updateRow(index, "charge_type", e.target.value)}
										>
											{CHARGE_TYPES.map((type) => (
												<option key={type} value={type}>
													{type}
												</option>
											))}
										</select>
									</td>
									<td className="px-3 py-2 align-top">
										<LinkField
											label=""
											doctype="Account"
											value={row.account_head || ""}
											onChange={(v) => updateRow(index, "account_head", v)}
											disabled={disabled}
											allowCreate={false}
											placeholder="Account"
										/>
									</td>
									<td className="px-3 py-2 align-top">
										<input
											type="text"
											value={row.description || ""}
											disabled={disabled}
											className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-50"
											onChange={(e) => updateRow(index, "description", e.target.value)}
										/>
									</td>
									<td className="px-3 py-2 align-top">
										<input
											type="number"
											value={row.rate ?? ""}
											disabled={disabled}
											className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-50"
											onChange={(e) => updateRow(index, "rate", e.target.value)}
										/>
									</td>
									<td className="px-3 py-2 align-top">
										<input
											type="number"
											value={row.tax_amount ?? ""}
											disabled={disabled || row.charge_type !== "Actual"}
											className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm disabled:bg-gray-50"
											onChange={(e) => updateRow(index, "tax_amount", e.target.value)}
										/>
									</td>
									{showPettyCash && (
										<td className="px-3 py-2 align-top">
											<input
												type="checkbox"
												checked={!!row.custom_is_petty_cash}
												disabled={disabled}
												className="rounded border-gray-300"
												onChange={(e) =>
													updateRow(index, "custom_is_petty_cash", e.target.checked ? 1 : 0)
												}
											/>
										</td>
									)}
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
					+ Add tax row
				</button>
			)}
		</div>
	);
}
