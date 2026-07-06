import frappe
from frappe.utils import add_months, flt, get_first_day, get_last_day, getdate, today


@frappe.whitelist()
def get_dashboard_analytics(from_date=None, to_date=None):
	"""Return aggregated Master Data analytics for the dashboard."""
	from_date, to_date = _resolve_date_range(from_date, to_date)
	values = {"from_date": from_date, "to_date": to_date}

	trend_from = add_months(get_first_day(to_date), -11)
	trend_values = {"trend_from": trend_from, "trend_to": to_date}

	return {
		"summary": _get_summary(values),
		"monthly_trend": _get_monthly_trend(trend_values),
		"top_taxi_suppliers": _get_top_taxi_suppliers(values),
		"top_crusher_suppliers": _get_top_crusher_suppliers(values),
		"top_projects": _get_top_projects(values),
		"top_customers": _get_top_customers(values),
		"supplier_activity": _get_supplier_activity(values),
	}


def _resolve_date_range(from_date, to_date):
	if not from_date and not to_date:
		from_date = get_first_day(today())
		to_date = get_last_day(today())
	elif from_date and not to_date:
		from_date = getdate(from_date)
		to_date = get_last_day(from_date)
	elif to_date and not from_date:
		to_date = getdate(to_date)
		from_date = get_first_day(to_date)
	else:
		from_date = getdate(from_date)
		to_date = getdate(to_date)

	if from_date > to_date:
		frappe.throw("From Date cannot be after To Date")

	return from_date, to_date


def _base_conditions(alias="md"):
	return f"""
		{alias}.docstatus = 1
		and {alias}.`date` is not null
		and {alias}.`date` between %(from_date)s and %(to_date)s
	"""


def _get_summary(values):
	row = frappe.db.sql(
		f"""
		select
			count(*) as transaction_count,
			coalesce(sum(md.do_grand_total), 0) as sales_total,
			coalesce(sum(md.taxi_grand_total + md.crusher_grand_total), 0) as purchase_total,
			count(distinct md.taxi) as unique_taxi_suppliers,
			count(distinct case
				when md.crusher_included = 0 and md.crusher is not null and md.crusher != ''
				then md.crusher
			end) as unique_crusher_suppliers,
			count(distinct md.project) as unique_projects,
			count(distinct md.customer) as unique_customers
		from `tabMaster Data` md
		where {_base_conditions("md")}
		""",
		values=values,
		as_dict=True,
	)[0]

	return {
		"transaction_count": row.transaction_count or 0,
		"sales_total": flt(row.sales_total),
		"purchase_total": flt(row.purchase_total),
		"unique_taxi_suppliers": row.unique_taxi_suppliers or 0,
		"unique_crusher_suppliers": row.unique_crusher_suppliers or 0,
		"unique_projects": row.unique_projects or 0,
		"unique_customers": row.unique_customers or 0,
	}


def _get_monthly_trend(values):
	rows = frappe.db.sql(
		"""
		select
			date_format(md.`date`, '%%Y-%%m') as month,
			count(*) as transactions,
			coalesce(sum(md.do_grand_total), 0) as sales_total,
			coalesce(sum(md.taxi_grand_total + md.crusher_grand_total), 0) as purchase_total,
			count(distinct md.taxi) + count(distinct case
				when md.crusher_included = 0 and md.crusher is not null and md.crusher != ''
				then md.crusher
			end) as active_suppliers
		from `tabMaster Data` md
		where md.docstatus = 1
			and md.`date` is not null
			and md.`date` between %(trend_from)s and %(trend_to)s
		group by date_format(md.`date`, '%%Y-%%m')
		order by month
		""",
		values=values,
		as_dict=True,
	)

	return [
		{
			"month": row.month,
			"transactions": row.transactions or 0,
			"sales_total": flt(row.sales_total),
			"purchase_total": flt(row.purchase_total),
			"active_suppliers": row.active_suppliers or 0,
		}
		for row in rows
	]


def _get_top_taxi_suppliers(values):
	rows = frappe.db.sql(
		f"""
		select
			md.taxi as supplier,
			s.supplier_name,
			count(*) as order_count,
			coalesce(sum(md.taxi_grand_total), 0) as total_amount
		from `tabMaster Data` md
		left join `tabSupplier` s on s.name = md.taxi
		where {_base_conditions("md")}
			and md.taxi is not null
			and md.taxi != ''
		group by md.taxi, s.supplier_name
		order by order_count desc, total_amount desc
		limit 10
		""",
		values=values,
		as_dict=True,
	)

	return [_format_supplier_row(row) for row in rows]


def _get_top_crusher_suppliers(values):
	rows = frappe.db.sql(
		f"""
		select
			md.crusher as supplier,
			s.supplier_name,
			count(*) as order_count,
			coalesce(sum(md.crusher_grand_total), 0) as total_amount
		from `tabMaster Data` md
		left join `tabSupplier` s on s.name = md.crusher
		where {_base_conditions("md")}
			and md.crusher_included = 0
			and md.crusher is not null
			and md.crusher != ''
		group by md.crusher, s.supplier_name
		order by order_count desc, total_amount desc
		limit 10
		""",
		values=values,
		as_dict=True,
	)

	return [_format_supplier_row(row) for row in rows]


def _get_top_projects(values):
	rows = frappe.db.sql(
		f"""
		select
			md.project,
			coalesce(p.project_name, md.project_name) as project_name,
			count(*) as transaction_count,
			coalesce(sum(md.do_grand_total), 0) as sales_total
		from `tabMaster Data` md
		left join `tabProject` p on p.name = md.project
		where {_base_conditions("md")}
			and md.project is not null
			and md.project != ''
		group by md.project, coalesce(p.project_name, md.project_name)
		order by transaction_count desc, sales_total desc
		limit 10
		""",
		values=values,
		as_dict=True,
	)

	return [
		{
			"project": row.project,
			"project_name": row.project_name or row.project,
			"transaction_count": row.transaction_count or 0,
			"sales_total": flt(row.sales_total),
		}
		for row in rows
	]


def _get_top_customers(values):
	rows = frappe.db.sql(
		f"""
		select
			md.customer,
			c.customer_name,
			count(*) as delivery_count,
			coalesce(sum(md.do_grand_total), 0) as sales_total
		from `tabMaster Data` md
		left join `tabCustomer` c on c.name = md.customer
		where {_base_conditions("md")}
			and md.customer is not null
			and md.customer != ''
		group by md.customer, c.customer_name
		order by delivery_count desc, sales_total desc
		limit 10
		""",
		values=values,
		as_dict=True,
	)

	return [
		{
			"customer": row.customer,
			"customer_name": row.customer_name or row.customer,
			"delivery_count": row.delivery_count or 0,
			"sales_total": flt(row.sales_total),
		}
		for row in rows
	]


def _get_supplier_activity(values):
	rows = frappe.db.sql(
		f"""
		select
			supplier,
			supplier_name,
			role,
			count(*) as project_count,
			coalesce(sum(total_amount), 0) as total_amount
		from (
			select
				md.taxi as supplier,
				s.supplier_name,
				'Taxi' as role,
				md.taxi_grand_total as total_amount
			from `tabMaster Data` md
			left join `tabSupplier` s on s.name = md.taxi
			where {_base_conditions("md")}
				and md.taxi is not null
				and md.taxi != ''

			union all

			select
				md.crusher as supplier,
				s.supplier_name,
				'Crusher' as role,
				md.crusher_grand_total as total_amount
			from `tabMaster Data` md
			left join `tabSupplier` s on s.name = md.crusher
			where {_base_conditions("md")}
				and md.crusher_included = 0
				and md.crusher is not null
				and md.crusher != ''
		) activity
		group by supplier, supplier_name, role
		order by project_count desc, total_amount desc
		""",
		values=values,
		as_dict=True,
	)

	return [
		{
			"supplier": row.supplier,
			"supplier_name": row.supplier_name or row.supplier,
			"role": row.role,
			"project_count": row.project_count or 0,
			"total_amount": flt(row.total_amount),
		}
		for row in rows
	]


def _format_supplier_row(row):
	return {
		"supplier": row.supplier,
		"supplier_name": row.supplier_name or row.supplier,
		"order_count": row.order_count or 0,
		"total_amount": flt(row.total_amount),
	}
