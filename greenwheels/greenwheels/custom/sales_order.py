# Copyright (c) 2024, ZedeXeL and Contributors
# License: MIT

"""
Custom functions for Sales Order
Updates custom_remaining_quantity field based on per_delivered percentage
"""

import frappe
from frappe.utils import flt


def update_so_custom_remaining_qty(doc, method=None):
	"""Update custom_remaining_quantity for all linked Sales Orders when Delivery Note is submitted/cancelled"""
	sales_orders = set()
	
	for item in doc.items:
		if item.against_sales_order:
			sales_orders.add(item.against_sales_order)
	
	for so_name in sales_orders:
		update_custom_remaining_qty_for_so(so_name)


def update_so_custom_remaining_qty_from_invoice(doc, method=None):
	"""Update custom_remaining_quantity for all linked Sales Orders when Sales Invoice with update_stock is submitted/cancelled"""
	# Only process if update_stock is enabled
	if not doc.update_stock:
		return
	
	sales_orders = set()
	
	for item in doc.items:
		if item.sales_order:
			sales_orders.add(item.sales_order)
	
	for so_name in sales_orders:
		update_custom_remaining_qty_for_so(so_name)


def update_custom_remaining_qty(doc, method=None):
	"""Update custom_remaining_quantity when Sales Order is submitted or updated after submit"""
	# Use the document directly if it's submitted, otherwise reload
	if doc.docstatus == 1:
		update_custom_remaining_qty_from_doc(doc)
	else:
		update_custom_remaining_qty_for_so(doc.name)


def update_custom_remaining_qty_from_doc(doc):
	"""
	Calculate and update custom_remaining_quantity from a Sales Order document object
	
	Formula: custom_remaining_quantity = total_qty * (100 - per_delivered) / 100
	"""
	try:
		# Skip if delivery note is skipped or document is not submitted
		if doc.skip_delivery_note or doc.docstatus != 1:
			return
		
		# Get total_qty - use field value or calculate from items if field is empty
		total_qty = flt(doc.total_qty)
		if not total_qty or total_qty == 0:
			# Calculate from items if total_qty field is not set
			total_qty = sum(flt(item.qty) for item in doc.items)
		
		if not total_qty or total_qty == 0:
			return
		
		# Get per_delivered - if None or not set, default to 0 (nothing delivered yet)
		per_delivered = flt(doc.per_delivered) if doc.per_delivered is not None else 0
		
		# Calculate remaining quantity: (100 - per_delivered) / 100 * total_qty
		remaining_percent = 100 - per_delivered
		custom_remaining_qty = total_qty * remaining_percent / 100
		
		# Ensure we don't set negative values
		custom_remaining_qty = max(0, custom_remaining_qty)
		
		# Update using db_set to allow updates on submitted documents
		doc.db_set("custom_remaining_quantity", custom_remaining_qty, update_modified=False)
		
	except Exception as e:
		# Log error but don't break the process
		frappe.log_error(
			message=f"Error updating custom_remaining_quantity for Sales Order {doc.name}: {str(e)}",
			title="Sales Order Custom Remaining Quantity Update Error"
		)


def update_custom_remaining_qty_for_so(so_name):
	"""
	Calculate and update custom_remaining_quantity for a Sales Order
	
	Formula: custom_remaining_quantity = total_qty * (100 - per_delivered) / 100
	"""
	try:
		so = frappe.get_doc("Sales Order", so_name)
		
		# Skip if delivery note is skipped or document is not submitted
		if so.skip_delivery_note or so.docstatus != 1:
			return
		
		# Skip if total_qty is not available or is zero
		if not so.total_qty or flt(so.total_qty) == 0:
			return
		
		# Get per_delivered - if None or not set, default to 0 (nothing delivered yet)
		per_delivered = flt(so.per_delivered) if so.per_delivered is not None else 0
		
		# Calculate remaining quantity: (100 - per_delivered) / 100 * total_qty
		remaining_percent = 100 - per_delivered
		custom_remaining_qty = flt(so.total_qty) * remaining_percent / 100
		
		# Ensure we don't set negative values
		custom_remaining_qty = max(0, custom_remaining_qty)
		
		# Update using db_set to allow updates on submitted documents
		so.db_set("custom_remaining_quantity", custom_remaining_qty, update_modified=False)
		
	except frappe.DoesNotExistError:
		# Sales Order doesn't exist, skip
		pass
	except Exception as e:
		# Log error but don't break the process
		frappe.log_error(
			message=f"Error updating custom_remaining_quantity for Sales Order {so_name}: {str(e)}",
			title="Sales Order Custom Remaining Quantity Update Error"
		)
