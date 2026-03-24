import frappe
from frappe.utils import flt


def execute(filters=None):
	filters = frappe._dict(filters or {})
	columns = get_columns()
	data = get_data(filters)
	return columns, data


def get_columns():
	return [
		{"label": "SI No", "fieldname": "si_no", "fieldtype": "Int", "width": 70},
		{"label": "Date", "fieldname": "posting_date", "fieldtype": "Date", "width": 100},
		{"label": "INV/CH NO", "fieldname": "reference_no", "fieldtype": "Data", "width": 120},
		{
			"label": "Account Head",
			"fieldname": "account_head",
			"fieldtype": "Link",
			"options": "Petty Cash Account Head",
			"width": 180,
		},
		{"label": "Material", "fieldname": "material", "fieldtype": "Data", "width": 120},
		{
			"label": "Crusher/Company Name",
			"fieldname": "vendor_company_name",
			"fieldtype": "Data",
			"width": 180,
		},
		{"label": "Description", "fieldname": "description", "fieldtype": "Data", "width": 240},
		{"label": "Credit", "fieldname": "credit", "fieldtype": "Currency", "width": 110},
		{"label": "Basic", "fieldname": "basic_amount", "fieldtype": "Currency", "width": 110},
		{"label": "VAT", "fieldname": "vat_amount", "fieldtype": "Currency", "width": 110},
		{"label": "Amount", "fieldname": "amount", "fieldtype": "Currency", "width": 110},
		{"label": "Grand Total", "fieldname": "grand_total", "fieldtype": "Currency", "width": 120},
		{"label": "Balance", "fieldname": "running_balance", "fieldtype": "Currency", "width": 120},
		{"label": "Paid By", "fieldname": "paid_by", "fieldtype": "Data", "width": 120},
		{"label": "Company", "fieldname": "company", "fieldtype": "Link", "options": "Company", "width": 140},
	]


def get_data(filters):
	conditions = ["pce.docstatus = 1"]
	values = {}

	if filters.get("from_date"):
		conditions.append("pce.posting_date >= %(from_date)s")
		values["from_date"] = filters.from_date

	if filters.get("to_date"):
		conditions.append("pce.posting_date <= %(to_date)s")
		values["to_date"] = filters.to_date

	if filters.get("petty_cash_account"):
		conditions.append("pce.petty_cash_account = %(petty_cash_account)s")
		values["petty_cash_account"] = filters.petty_cash_account

	if filters.get("entry_type"):
		conditions.append("pce.entry_type = %(entry_type)s")
		values["entry_type"] = filters.entry_type

	if filters.get("company"):
		conditions.append("pce.company = %(company)s")
		values["company"] = filters.company

	rows = frappe.db.sql(
		f"""
		select
			pce.name,
			pce.posting_date,
			pce.reference_no,
			pce.account_head,
			pce.material,
			pce.vendor_company_name,
			pce.description,
			pce.entry_type,
			pce.amount,
			pce.basic_amount,
			pce.vat_amount,
			pce.grand_total,
			pce.paid_by,
			pce.company,
			pce.petty_cash_account
		from `tabPetty Cash Entry` pce
		where {" and ".join(conditions)}
		order by pce.posting_date, pce.creation, pce.name
		""",
		values=values,
		as_dict=True,
	)

	if not rows:
		return []

	account_opening = {}
	if filters.get("petty_cash_account"):
		account_opening[filters.petty_cash_account] = flt(
			frappe.db.get_value("Petty Cash Account", filters.petty_cash_account, "opening_balance") or 0
		)
	else:
		account_names = list({row.petty_cash_account for row in rows})
		opening_rows = frappe.get_all(
			"Petty Cash Account",
			filters={"name": ["in", account_names]},
			fields=["name", "opening_balance"],
		)
		account_opening = {d.name: flt(d.opening_balance) for d in opening_rows}

	account_running = {name: opening for name, opening in account_opening.items()}
	result = []

	for idx, row in enumerate(rows, start=1):
		credit = flt(row.amount) if row.entry_type == "Topup" else 0
		debit_amount = flt(row.amount) if row.entry_type == "Debit" else 0

		running = flt(account_running.get(row.petty_cash_account, 0))
		if row.entry_type == "Topup":
			running += flt(row.amount)
		else:
			running -= flt(row.amount)
		account_running[row.petty_cash_account] = running

		result.append(
			{
				"si_no": idx,
				"posting_date": row.posting_date,
				"reference_no": row.reference_no,
				"account_head": row.account_head,
				"material": row.material,
				"vendor_company_name": row.vendor_company_name,
				"description": row.description,
				"credit": credit,
				"basic_amount": flt(row.basic_amount),
				"vat_amount": flt(row.vat_amount),
				"amount": debit_amount if row.entry_type == "Debit" else flt(row.amount),
				"grand_total": flt(row.grand_total) if row.entry_type == "Debit" else flt(row.amount),
				"running_balance": running,
				"paid_by": row.paid_by,
				"company": row.company,
			}
		)

	return result
