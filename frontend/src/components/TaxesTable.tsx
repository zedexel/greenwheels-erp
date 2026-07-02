import { CurrencyCell } from "@/components/FormSection";
import LinkField from "@/components/LinkField";
import { fetchTaxRate, type TaxRow } from "@/lib/master-data";

interface TaxesTableProps {
	value: TaxRow[];
	onChange: (rows: TaxRow[]) => void;
	disabled?: boolean;
	showPettyCash?: boolean;
	parentfield: string;
	referenceDoctype?: string;
}

const CHARGE_TYPES = ["On Net Total", "Actual", "On Previous Row Amount", "On Previous Row Total"];

export default function TaxesTable({
	value,
	onChange,
	disabled,
	showPettyCash,
	parentfield,
	referenceDoctype,
}: TaxesTableProps) {
	function updateRow(index: number, key: string, cellValue: unknown) {
		const rows = [...value];
		rows[index] = { ...rows[index], [key]: cellValue };
		onChange(rows);
	}

	async function applyTaxRate(index: number, accountHead: string, chargeType: string) {
		if (!accountHead || !chargeType) return;

		const details = await fetchTaxRate(accountHead);
		if (!details) return;

		const rows = [...value];
		const row = { ...rows[index], account_head: accountHead };

		if (chargeType !== "Actual") {
			row.rate = details.tax_rate ?? 0;
		}
		if (!row.description) {
			row.description = details.account_name || accountHead;
		}

		rows[index] = row;
		onChange(rows);
	}

	async function handleAccountHeadChange(index: number, accountHead: string) {
		const row = value[index];

		if (!accountHead) {
			const rows = [...value];
			rows[index] = { ...rows[index], account_head: "", rate: 0, description: "" };
			onChange(rows);
			return;
		}

		if (!row.charge_type) {
			window.alert("Please select Charge Type first");
			return;
		}

		await applyTaxRate(index, accountHead, row.charge_type);
	}

	async function handleChargeTypeChange(index: number, chargeType: string) {
		const row = value[index];
		const rows = [...value];
		rows[index] = { ...rows[index], charge_type: chargeType };
		onChange(rows);

		if (row.account_head && chargeType) {
			await applyTaxRate(index, row.account_head, chargeType);
		}
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

	const colSpan = showPettyCash ? 7 : 6;

	return (
		<div className="space-y-3">
			<div className="overflow-x-auto rounded-lg border border-gray-200">
				<table className="min-w-full divide-y divide-gray-200 text-sm">
					<thead className="bg-gray-50">
						<tr>
							<th className="px-3 py-2 text-left font-medium text-gray-600">Type</th>
							{showPettyCash && (
								<th className="px-3 py-2 text-left font-medium text-gray-600">
									Pay via Petty Cash
								</th>
							)}
							<th className="px-3 py-2 text-left font-medium text-gray-600">
								Account Head
							</th>
							<th className="px-3 py-2 text-left font-medium text-gray-600">Tax Rate</th>
							<th className="px-3 py-2 text-left font-medium text-gray-600">Amount</th>
							<th className="px-3 py-2 text-left font-medium text-gray-600">Total</th>
							<th className="px-3 py-2" />
						</tr>
					</thead>
					<tbody className="divide-y divide-gray-100 bg-white">
						{!value.length ? (
							<tr>
								<td colSpan={colSpan} className="px-3 py-6 text-center text-gray-500">
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
											onChange={(e) => handleChargeTypeChange(index, e.target.value)}
										>
											{CHARGE_TYPES.map((type) => (
												<option key={type} value={type}>
													{type}
												</option>
											))}
										</select>
									</td>
									{showPettyCash && (
										<td className="px-3 py-2 align-top">
											<input
												type="checkbox"
												checked={!!row.custom_is_petty_cash}
												disabled={disabled}
												className="rounded border-gray-300"
												onChange={(e) =>
													updateRow(
														index,
														"custom_is_petty_cash",
														e.target.checked ? 1 : 0,
													)
												}
											/>
										</td>
									)}
									<td className="px-3 py-2 align-top">
										<LinkField
											label=""
											doctype="Account"
											value={row.account_head || ""}
											onChange={(v) => handleAccountHeadChange(index, v)}
											disabled={disabled}
											allowCreate={false}
											referenceDoctype={referenceDoctype}
											dropdownPlacement="above"
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
										{row.charge_type === "Actual" && !disabled ? (
											<input
												type="number"
												value={row.tax_amount ?? ""}
												className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
												onChange={(e) =>
													updateRow(index, "tax_amount", e.target.value)
												}
											/>
										) : (
											<CurrencyCell value={row.tax_amount} />
										)}
									</td>
									<td className="px-3 py-2 align-top">
										<CurrencyCell value={row.total} />
									</td>
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
