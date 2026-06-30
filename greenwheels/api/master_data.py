import frappe
from frappe.utils import flt

from erpnext import get_company_currency
from erpnext.stock.get_item_details import get_item_details


@frappe.whitelist()
def save_master_data(doc):
	"""Insert or update Master Data with row enrichment for React frontend."""
	if isinstance(doc, str):
		doc = frappe.parse_json(doc)

	doc = frappe._dict(doc)
	_enrich_master_data_doc(doc)

	if doc.get("name"):
		existing = frappe.get_doc("Master Data", doc.name)
		existing.update(doc)
		existing.save()
		return existing.as_dict()

	new_doc = frappe.get_doc(doc)
	new_doc.insert()
	return new_doc.as_dict()


@frappe.whitelist()
def calculate_master_data_totals(doc):
	"""Calculate section totals without persisting the document."""
	if isinstance(doc, str):
		doc = frappe.parse_json(doc)

	doc = frappe._dict(doc)
	_enrich_master_data_doc(doc)

	md = frappe.get_doc({"doctype": "Master Data", **doc})
	md.calculate_taxi_po_totals()
	if not md.crusher_included:
		md.calculate_crusher_po_totals()
	else:
		md.crusher_grand_total = 0
	md.calculate_delivery_note_totals()

	return md.as_dict()


@frappe.whitelist()
def submit_master_data(name):
	"""Submit a Master Data document."""
	doc = frappe.get_doc("Master Data", name)
	doc.submit()
	return doc.as_dict()


def _enrich_master_data_doc(doc):
	if doc.get("project") and not doc.get("project_name"):
		doc.project_name = frappe.db.get_value("Project", doc.project, "project_name")

	if not doc.get("taxi_taxes"):
		doc.taxi_taxes = []
	if not doc.get("crusher_taxes"):
		doc.crusher_taxes = []
	if not doc.get("taxes"):
		doc.taxes = []

	if doc.get("crusher_included"):
		doc.crusher = None
		doc.crusher_date = None
		doc.crusher_items = []
		doc.crusher_taxes = []

	company_currency = get_company_currency(doc.company) if doc.get("company") else None

	for index, row in enumerate(doc.get("taxi_items") or [], start=1):
		_enrich_po_row(
			row,
			parentfield="taxi_items",
			idx=index,
			company=doc.company,
			supplier=doc.taxi,
			transaction_date=doc.taxi_date,
			company_currency=company_currency,
		)

	for index, row in enumerate(doc.get("crusher_items") or [], start=1):
		_enrich_po_row(
			row,
			parentfield="crusher_items",
			idx=index,
			company=doc.company,
			supplier=doc.crusher,
			transaction_date=doc.crusher_date,
			company_currency=company_currency,
		)

	for index, row in enumerate(doc.get("items") or [], start=1):
		_enrich_dn_row(
			row,
			parentfield="items",
			idx=index,
			company=doc.company,
			customer=doc.customer,
			posting_date=doc.date,
			company_currency=company_currency,
		)


def _enrich_po_row(row, parentfield, idx, company, supplier, transaction_date, company_currency):
	row["doctype"] = row.get("doctype") or "Purchase Order Item"
	row["parentfield"] = parentfield
	row["idx"] = idx

	if row.get("item_code") and (not row.get("item_name") or not row.get("uom")):
		details = get_item_details(
			{
				"item_code": row["item_code"],
				"company": company,
				"supplier": supplier,
				"transaction_date": transaction_date,
				"conversion_rate": 1,
				"buying_price_list": None,
				"price_list_currency": company_currency,
				"plc_conversion_rate": 1,
				"ignore_pricing_rule": 1,
				"doctype": "Purchase Order",
				"qty": row.get("qty") or 1,
				"uom": row.get("uom"),
				"conversion_factor": row.get("conversion_factor"),
			},
			doc={
				"doctype": "Purchase Order",
				"company": company,
				"supplier": supplier,
				"transaction_date": transaction_date,
				"conversion_rate": 1,
				"ignore_pricing_rule": 1,
			},
		)
		_apply_item_details(row, details)

	if not row.get("schedule_date") and transaction_date:
		row["schedule_date"] = transaction_date

	_calculate_row_amounts(row)


def _enrich_dn_row(row, parentfield, idx, company, customer, posting_date, company_currency):
	row["doctype"] = row.get("doctype") or "Delivery Note Item"
	row["parentfield"] = parentfield
	row["idx"] = idx

	if row.get("item_code") and (not row.get("item_name") or not row.get("uom")):
		details = get_item_details(
			{
				"item_code": row["item_code"],
				"company": company,
				"customer": customer,
				"transaction_date": posting_date,
				"conversion_rate": 1,
				"selling_price_list": None,
				"price_list_currency": company_currency,
				"plc_conversion_rate": 1,
				"ignore_pricing_rule": 1,
				"doctype": "Delivery Note",
				"qty": row.get("qty") or 1,
				"uom": row.get("uom"),
				"conversion_factor": row.get("conversion_factor"),
			},
			doc={
				"doctype": "Delivery Note",
				"company": company,
				"customer": customer,
				"posting_date": posting_date,
				"conversion_rate": 1,
				"ignore_pricing_rule": 1,
			},
		)
		_apply_item_details(row, details)

	_calculate_row_amounts(row)


def _apply_item_details(row, details):
	if not details:
		return

	if details.get("item_name"):
		row["item_name"] = details.item_name
	elif row.get("item_code") and not row.get("item_name"):
		row["item_name"] = row["item_code"]

	if details.get("conversion_factor"):
		row["conversion_factor"] = details.conversion_factor
	elif not row.get("conversion_factor"):
		row["conversion_factor"] = 1

	if details.get("uom") and not row.get("uom"):
		row["uom"] = details.uom

	if details.get("stock_uom") and not row.get("stock_uom"):
		row["stock_uom"] = details.stock_uom

	if not row.get("rate") or flt(row.get("rate")) == 0:
		row["rate"] = details.get("price_list_rate") or details.get("rate") or 0


def _calculate_row_amounts(row):
	qty = flt(row.get("qty")) or 0
	rate = flt(row.get("rate")) or 0
	discount_amount = flt(row.get("discount_amount")) or 0

	row["amount"] = qty * rate
	row["base_amount"] = row["amount"]
	row["base_rate"] = rate
	row["net_amount"] = row["amount"] - discount_amount
	row["base_net_amount"] = row["net_amount"]
