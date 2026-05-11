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
		{"label": "Invoice/Voucher", "fieldname": "invoice_voucher", "fieldtype": "Data", "width": 140},
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
		{
			"label": "Paid By",
			"fieldname": "paid_by_account",
			"fieldtype": "Link",
			"options": "Petty Cash Account",
			"width": 140,
		},
		{
			"label": "Transfer Account",
			"fieldname": "transfer_account",
			"fieldtype": "Link",
			"options": "Petty Cash Account",
			"width": 160,
		},
		{"label": "Company", "fieldname": "company", "fieldtype": "Link", "options": "Company", "width": 140},
	]


def get_data(filters):
	# Build shared conditions (date, entry_type, company).
	# The account filter is handled separately so each side of the UNION
	# can filter on its own relevant account column.
	conditions = ["pce.docstatus = 1"]
	values = {}

	if filters.get("from_date"):
		conditions.append("pce.posting_date >= %(from_date)s")
		values["from_date"] = filters.from_date

	if filters.get("to_date"):
		conditions.append("pce.posting_date <= %(to_date)s")
		values["to_date"] = filters.to_date

	if filters.get("entry_type"):
		conditions.append("pce.entry_type = %(entry_type)s")
		values["entry_type"] = filters.entry_type

	if filters.get("company"):
		conditions.append("pce.company = %(company)s")
		values["company"] = filters.company

	where_clause = " and ".join(conditions)

	# Account filter applied per-side of the UNION.
	account_filter_source = ""
	account_filter_dest = ""
	if filters.get("petty_cash_account"):
		account_filter_source = "and pce.petty_cash_account = %(petty_cash_account)s"
		# Second UNION: this account appears as the destination of a transfer.
		account_filter_dest = "and pce.to_petty_cash_account = %(petty_cash_account)s"
		values["petty_cash_account"] = filters.petty_cash_account

	rows = frappe.db.sql(
		f"""
		select
			pce.name,
			pce.posting_date,
			pce.creation,
			pce.invoice_voucher,
			pce.account_head,
			pce.material,
			pce.vendor_company_name,
			pce.description,
			pce.entry_type,
			pce.amount,
			pce.basic_amount,
			pce.vat_amount,
			pce.grand_total,
			pce.company,
			pce.petty_cash_account,
			pce.to_petty_cash_account as transfer_account,
			'source' as transfer_role
		from `tabPetty Cash Entry` pce
		where {where_clause} {account_filter_source}

		union all

		select
			pce.name,
			pce.posting_date,
			pce.creation,
			pce.invoice_voucher,
			pce.account_head,
			pce.material,
			pce.vendor_company_name,
			pce.description,
			pce.entry_type,
			pce.amount,
			pce.basic_amount,
			pce.vat_amount,
			pce.grand_total,
			pce.company,
			pce.to_petty_cash_account as petty_cash_account,
			pce.petty_cash_account as transfer_account,
			'destination' as transfer_role
		from `tabPetty Cash Entry` pce
		where {where_clause}
		  and pce.entry_type = 'Account to Account'
		  {account_filter_dest}

		order by posting_date, creation, name
		""",
		values=values,
		as_dict=True,
	)

	if not rows:
		return []

	# Collect all unique accounts referenced across both UNION halves.
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
		is_incoming = (
			row.entry_type == "Topup"
			or (row.entry_type == "Account to Account" and row.transfer_role == "destination")
		)

		credit = flt(row.amount) if is_incoming else 0
		debit_amount = flt(row.amount) if not is_incoming else 0

		running = flt(account_running.get(row.petty_cash_account, 0))
		if is_incoming:
			running += flt(row.amount)
		else:
			running -= flt(row.amount)
		account_running[row.petty_cash_account] = running

		result.append(
			{
				"si_no": idx,
				"posting_date": row.posting_date,
				"invoice_voucher": row.invoice_voucher,
				"account_head": row.account_head,
				"material": row.material,
				"vendor_company_name": row.vendor_company_name,
				"description": row.description,
				"credit": credit,
				"basic_amount": flt(row.basic_amount) if not is_incoming else 0,
				"vat_amount": flt(row.vat_amount) if not is_incoming else 0,
				"amount": debit_amount,
				"grand_total": flt(row.grand_total) if row.entry_type == "Debit" else (
					flt(row.amount) if not is_incoming else 0
				),
				"running_balance": running,
				"paid_by_account": row.petty_cash_account,
				"transfer_account": row.transfer_account or None,
				"company": row.company,
			}
		)

	return result
