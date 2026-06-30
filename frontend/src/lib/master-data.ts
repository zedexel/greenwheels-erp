import { frappeCall, frappePost } from "@/lib/frappe-api";

export interface LineItemRow {
	item_code?: string;
	item_name?: string;
	qty?: number | string;
	rate?: number | string;
	schedule_date?: string;
	uom?: string;
	stock_uom?: string;
	conversion_factor?: number | string;
	amount?: number;
	net_amount?: number;
	discount_amount?: number;
	doctype?: string;
	parentfield?: string;
	idx?: number;
	__key?: string;
}

export interface TaxRow {
	charge_type?: string;
	account_head?: string;
	description?: string;
	rate?: number | string;
	tax_amount?: number | string;
	total?: number | string;
	custom_is_petty_cash?: number | boolean;
	doctype?: string;
	parentfield?: string;
	idx?: number;
	__key?: string;
}

export interface MasterDataDoc {
	doctype: string;
	name?: string;
	docstatus?: number;
	project?: string;
	project_name?: string;
	company?: string;
	taxi?: string;
	taxi_date?: string;
	taxi_invoice?: string;
	taxi_invoice_date?: string;
	taxi_attachement?: string;
	taxi_petty_cash_account?: string;
	taxi_petty_cash_account_head?: string;
	crusher_included?: number | boolean;
	taxi_items: LineItemRow[];
	taxi_taxes: TaxRow[];
	taxi_grand_total?: number;
	taxi_po_name?: string;
	crusher?: string;
	crusher_date?: string;
	crusher_reference?: string;
	custom_payment?: string;
	crusher_petty_cash_account?: string;
	crusher_petty_cash_account_head?: string;
	crusher_attachement?: string;
	crusher_items: LineItemRow[];
	crusher_taxes: TaxRow[];
	crusher_grand_total?: number;
	crusher_po_name?: string;
	customer?: string;
	date?: string;
	time?: string;
	do_number?: string;
	vehicle_number?: string;
	do_attachement?: string;
	items: LineItemRow[];
	taxes: TaxRow[];
	do_grand_total?: number;
	delivery_note_name?: string;
}

export const PO_ITEM_COLUMNS = [
	{ key: "item_code", label: "Item", type: "link" as const, linkDoctype: "Item" },
	{ key: "qty", label: "Qty", type: "number" as const },
	{ key: "rate", label: "Rate", type: "number" as const },
	{ key: "schedule_date", label: "Required By", type: "date" as const },
];

export const DN_ITEM_COLUMNS = [
	{ key: "item_code", label: "Item", type: "link" as const, linkDoctype: "Item" },
	{ key: "qty", label: "Qty", type: "number" as const },
	{ key: "rate", label: "Rate", type: "number" as const },
];

const TABLE_PARENTFIELDS: Record<string, string> = {
	taxi_items: "taxi_items",
	crusher_items: "crusher_items",
	items: "items",
};

export function emptyMasterDataDoc(): MasterDataDoc {
	return {
		doctype: "Master Data",
		crusher_included: 0,
		taxi_items: [],
		crusher_items: [],
		items: [],
		taxi_taxes: [],
		crusher_taxes: [],
		taxes: [],
	};
}

function isInvalidQty(qty: unknown): boolean {
	if (qty === undefined || qty === null || qty === "") return true;
	return Number(qty) <= 0;
}

export function validateMasterData(doc: MasterDataDoc): string[] {
	const errors: string[] = [];

	if (!doc.project) errors.push("Project is required");
	if (!doc.company) errors.push("Company is required");
	if (!doc.taxi) errors.push("Taxi supplier is required");
	if (!doc.taxi_date) errors.push("Taxi date is required");
	if (!doc.customer) errors.push("Customer is required");
	if (!doc.date) errors.push("Delivery order date is required");

	if (!doc.taxi_items?.length) {
		errors.push("Add at least one Taxi PO item");
	} else {
		doc.taxi_items.forEach((row, index) => {
			if (!row.item_code) errors.push(`Taxi PO row ${index + 1}: item is required`);
			if (isInvalidQty(row.qty)) errors.push(`Taxi PO row ${index + 1}: qty is required`);
		});
	}

	const hasTaxiPettyCash = (doc.taxi_taxes || []).some((t) => t.custom_is_petty_cash);
	if (hasTaxiPettyCash) {
		if (!doc.taxi_petty_cash_account) {
			errors.push("Taxi petty cash account is required when a tax row is marked petty cash");
		}
		if (!doc.taxi_petty_cash_account_head) {
			errors.push("Taxi petty cash account head is required when a tax row is marked petty cash");
		}
	}

	if (!doc.crusher_included) {
		if (!doc.crusher) errors.push("Crusher supplier is required");
		if (!doc.crusher_date) errors.push("Crusher date is required");
		if (!doc.crusher_items?.length) {
			errors.push("Add at least one Crusher PO item");
		} else {
			doc.crusher_items.forEach((row, index) => {
				if (!row.item_code) errors.push(`Crusher PO row ${index + 1}: item is required`);
				if (isInvalidQty(row.qty)) {
					errors.push(`Crusher PO row ${index + 1}: qty is required`);
				}
			});
		}
		if (doc.custom_payment === "Cash") {
			if (!doc.crusher_petty_cash_account) {
				errors.push("Crusher petty cash account is required for cash payment");
			}
			if (!doc.crusher_petty_cash_account_head) {
				errors.push("Crusher petty cash account head is required for cash payment");
			}
		}
	}

	if (!doc.items?.length) {
		errors.push("Add at least one Delivery Order item");
	} else {
		doc.items.forEach((row, index) => {
			if (!row.item_code) errors.push(`Delivery Order row ${index + 1}: item is required`);
			if (isInvalidQty(row.qty)) {
				errors.push(`Delivery Order row ${index + 1}: qty is required`);
			}
		});
	}

	return errors;
}

function getChildDoctype(table: string): string {
	if (table === "items") return "Delivery Note Item";
	return "Purchase Order Item";
}

function cleanChildRow(row: LineItemRow, table: string, index: number): LineItemRow {
	const cleanRow = { ...row };
	delete cleanRow.__key;

	cleanRow.doctype = cleanRow.doctype || getChildDoctype(table);
	cleanRow.parentfield = TABLE_PARENTFIELDS[table] || table;
	cleanRow.idx = index + 1;

	if (cleanRow.qty !== undefined && cleanRow.qty !== "") {
		cleanRow.qty = Number(cleanRow.qty);
	}
	if (cleanRow.rate !== undefined && cleanRow.rate !== "") {
		cleanRow.rate = Number(cleanRow.rate);
	}
	if (cleanRow.conversion_factor !== undefined && cleanRow.conversion_factor !== "") {
		cleanRow.conversion_factor = Number(cleanRow.conversion_factor);
	}

	return cleanRow;
}

export function serializeMasterDataDoc(doc: MasterDataDoc): MasterDataDoc {
	const payload = JSON.parse(JSON.stringify(doc)) as MasterDataDoc;

	for (const table of ["taxi_items", "crusher_items", "items"] as const) {
		payload[table] = (payload[table] || []).map((row, index) =>
			cleanChildRow(row, table, index),
		);
	}

	payload.taxi_taxes = payload.taxi_taxes || [];
	payload.crusher_taxes = payload.crusher_taxes || [];
	payload.taxes = payload.taxes || [];

	if (payload.crusher_included) {
		payload.crusher = undefined;
		payload.crusher_date = undefined;
		payload.crusher_items = [];
		payload.crusher_taxes = [];
	}

	return payload;
}

export async function fetchProjectName(project: string): Promise<string | null> {
	if (!project) return null;

	const value = await frappeCall<{ project_name?: string }>("frappe.client.get_value", {
		doctype: "Project",
		filters: { name: project },
		fieldname: "project_name",
	});
	return value?.project_name || null;
}

function applyItemAmounts(row: LineItemRow): LineItemRow {
	const qty = Number(row.qty) || 0;
	const rate = Number(row.rate) || 0;
	const discountAmount = Number(row.discount_amount) || 0;

	row.amount = qty * rate;
	row.base_amount = row.amount;
	row.base_rate = rate;
	row.net_amount = (row.amount ?? 0) - discountAmount;
	row.base_net_amount = row.net_amount;

	return row;
}

function applyItemDetailsToRow(
	row: LineItemRow,
	itemDetails: Record<string, unknown>,
): LineItemRow {
	const updated = { ...row };

	if (itemDetails.item_name) {
		updated.item_name = String(itemDetails.item_name);
	} else if (updated.item_code) {
		updated.item_name = updated.item_code;
	}

	if (itemDetails.conversion_factor) {
		updated.conversion_factor = itemDetails.conversion_factor as number;
	} else if (!updated.conversion_factor) {
		updated.conversion_factor = 1;
	}

	if (itemDetails.uom && !updated.uom) {
		updated.uom = String(itemDetails.uom);
	}

	if (itemDetails.stock_uom && !updated.stock_uom) {
		updated.stock_uom = String(itemDetails.stock_uom);
	}

	if (!updated.rate || Number(updated.rate) === 0) {
		updated.rate =
			(itemDetails.price_list_rate as number) || (itemDetails.rate as number) || 0;
	}

	return applyItemAmounts(updated);
}

export async function fetchPurchaseItemDetails(
	row: LineItemRow,
	context: { company?: string; supplier?: string; transactionDate?: string },
): Promise<LineItemRow> {
	const { company, supplier, transactionDate } = context;
	if (!company || !supplier || !row.item_code) return row;

	const itemDetails = await frappeCall<Record<string, unknown>>(
		"erpnext.stock.get_item_details.get_item_details",
		{
			doc: {
				doctype: "Purchase Order",
				company,
				supplier,
				transaction_date: transactionDate,
				conversion_rate: 1,
				buying_price_list: null,
				ignore_pricing_rule: 1,
			},
			args: {
				item_code: row.item_code,
				company,
				supplier,
				transaction_date: transactionDate,
				conversion_rate: 1,
				buying_price_list: null,
				price_list_currency: null,
				plc_conversion_rate: 1,
				ignore_pricing_rule: 1,
				doctype: "Purchase Order",
				qty: row.qty || 1,
				uom: row.uom,
				conversion_factor: row.conversion_factor,
			},
		},
	);

	return applyItemDetailsToRow(row, itemDetails || {});
}

export async function fetchDeliveryItemDetails(
	row: LineItemRow,
	context: { company?: string; customer?: string; postingDate?: string },
): Promise<LineItemRow> {
	const { company, customer, postingDate } = context;
	if (!company || !customer || !row.item_code) return row;

	const itemDetails = await frappeCall<Record<string, unknown>>(
		"erpnext.stock.get_item_details.get_item_details",
		{
			doc: {
				doctype: "Delivery Note",
				company,
				customer,
				posting_date: postingDate,
				conversion_rate: 1,
				selling_price_list: null,
				ignore_pricing_rule: 1,
			},
			args: {
				item_code: row.item_code,
				company,
				customer,
				transaction_date: postingDate,
				conversion_rate: 1,
				selling_price_list: null,
				price_list_currency: null,
				plc_conversion_rate: 1,
				ignore_pricing_rule: 1,
				doctype: "Delivery Note",
				qty: row.qty || 1,
				uom: row.uom,
				conversion_factor: row.conversion_factor,
			},
		},
	);

	return applyItemDetailsToRow(row, itemDetails || {});
}

export function recalculateRowAmounts(row: LineItemRow): LineItemRow {
	return applyItemAmounts({ ...row });
}

export async function saveMasterData(doc: MasterDataDoc): Promise<MasterDataDoc> {
	return frappePost<MasterDataDoc>("greenwheels.api.master_data.save_master_data", {
		doc: serializeMasterDataDoc(doc),
	});
}

export async function calculateMasterDataTotals(
	doc: MasterDataDoc,
): Promise<MasterDataDoc> {
	return frappePost<MasterDataDoc>(
		"greenwheels.api.master_data.calculate_master_data_totals",
		{ doc: serializeMasterDataDoc(doc) },
	);
}

export async function submitMasterData(name: string): Promise<MasterDataDoc> {
	return frappePost<MasterDataDoc>("greenwheels.api.master_data.submit_master_data", {
		name,
	});
}
