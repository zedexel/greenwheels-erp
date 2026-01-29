# Copyright (c) 2026, ZedeXeL and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt, getdate
from erpnext import get_company_currency


class MasterData(Document):
	def validate(self):
		"""Validate Master Data document"""
		# Get company currency for use in child documents
		if self.company:
			self._company_currency = get_company_currency(self.company)
		else:
			self._company_currency = None

		# Set disable_rounded_total to prevent rounding (if field exists)
		if hasattr(self, "disable_rounded_total"):
			if self.disable_rounded_total != 1:
				self.disable_rounded_total = 1

		# Validate required fields
		if not self.company:
			frappe.throw(_("Company is mandatory"))

		if not self.taxi:
			frappe.throw(_("Taxi Supplier is mandatory"))

		if not self.taxi_date:
			frappe.throw(_("Taxi Date is mandatory"))

		if not self.customer:
			frappe.throw(_("Customer is mandatory"))

		if not self.date:
			frappe.throw(_("Delivery Note Date is mandatory"))

		# Validate items exist
		if not self.taxi_items or len(self.taxi_items) == 0:
			frappe.throw(_("Please add at least one item in Taxi PO"))

		# If crusher_included is False, there is a separate crusher supplier, so validate crusher PO
		if not self.crusher_included:
			if not self.crusher:
				frappe.throw(_("Crusher Supplier is mandatory when Crusher Included is not checked"))
			if not self.crusher_date:
				frappe.throw(_("Crusher Date is mandatory when Crusher Included is not checked"))
			if not self.crusher_items or len(self.crusher_items) == 0:
				frappe.throw(_("Please add at least one item in Crusher PO when Crusher Included is not checked"))

		if not self.items or len(self.items) == 0:
			frappe.throw(_("Please add at least one item in Delivery Note"))

	def before_save(self):
		"""Create or update Purchase Orders and Delivery Note before saving"""
		# Create/update Taxi Purchase Order
		self.create_or_update_purchase_order(
			supplier=self.taxi,
			transaction_date=self.taxi_date,
			items=self.taxi_items,
			taxes=self.taxi_taxes,
			grand_total=self.taxi_grand_total,
			field_name="taxi_po_name",
		)

		# Create/update Crusher Purchase Order only if crusher_included is False (separate crusher supplier)
		if not self.crusher_included:
			self.create_or_update_purchase_order(
				supplier=self.crusher,
				transaction_date=self.crusher_date,
				items=self.crusher_items,
				taxes=self.crusher_taxes,
				grand_total=self.crusher_grand_total,
				field_name="crusher_po_name",
			)
		else:
			# Cancel and clear crusher PO if crusher_included is True (crusher is included with taxi)
			if self.crusher_po_name:
				try:
					po_doc = frappe.get_doc("Purchase Order", self.crusher_po_name)
					if po_doc.docstatus == 1:
						po_doc.cancel()
					frappe.delete_doc("Purchase Order", self.crusher_po_name, force=1)
					self.crusher_po_name = None
				except frappe.DoesNotExistError:
					self.crusher_po_name = None

		# Create/update Delivery Note
		self.create_or_update_delivery_note()

	def on_submit(self):
		"""Submit linked Purchase Orders and Delivery Note"""
		# Submit Taxi Purchase Order
		if self.taxi_po_name:
			po_doc = frappe.get_doc("Purchase Order", self.taxi_po_name)
			if po_doc.docstatus == 0:
				po_doc.submit()

		# Submit Crusher Purchase Order if it exists
		if self.crusher_po_name:
			po_doc = frappe.get_doc("Purchase Order", self.crusher_po_name)
			if po_doc.docstatus == 0:
				po_doc.submit()

		# Submit Delivery Note
		if self.delivery_note_name:
			dn_doc = frappe.get_doc("Delivery Note", self.delivery_note_name)
			if dn_doc.docstatus == 0:
				dn_doc.submit()

	def on_cancel(self):
		"""Cancel linked Purchase Orders and Delivery Note"""
		# Cancel Taxi Purchase Order
		if self.taxi_po_name:
			try:
				po_doc = frappe.get_doc("Purchase Order", self.taxi_po_name)
				if po_doc.docstatus == 1:
					po_doc.cancel()
			except frappe.DoesNotExistError:
				pass

		# Cancel Crusher Purchase Order
		if self.crusher_po_name:
			try:
				po_doc = frappe.get_doc("Purchase Order", self.crusher_po_name)
				if po_doc.docstatus == 1:
					po_doc.cancel()
			except frappe.DoesNotExistError:
				pass

		# Cancel Delivery Note
		if self.delivery_note_name:
			try:
				dn_doc = frappe.get_doc("Delivery Note", self.delivery_note_name)
				if dn_doc.docstatus == 1:
					dn_doc.cancel()
			except frappe.DoesNotExistError:
				pass

	def on_trash(self):
		"""Delete linked Purchase Orders and Delivery Note when Master Data is deleted in draft"""
		# Only delete linked documents if Master Data is in draft (docstatus == 0)
		if self.docstatus == 0:
			# Delete Taxi Purchase Order
			if self.taxi_po_name:
				try:
					frappe.delete_doc("Purchase Order", self.taxi_po_name, force=1, ignore_permissions=True)
				except (frappe.DoesNotExistError, frappe.LinkExistsError):
					pass

			# Delete Crusher Purchase Order
			if self.crusher_po_name:
				try:
					frappe.delete_doc("Purchase Order", self.crusher_po_name, force=1, ignore_permissions=True)
				except (frappe.DoesNotExistError, frappe.LinkExistsError):
					pass

			# Delete Delivery Note
			if self.delivery_note_name:
				try:
					frappe.delete_doc("Delivery Note", self.delivery_note_name, force=1, ignore_permissions=True)
				except (frappe.DoesNotExistError, frappe.LinkExistsError):
					pass

	def on_update_after_submit(self):
		"""Handle amendments - create amended versions of linked documents"""
		# Handle Taxi PO amendment
		if self.taxi_po_name and self.amended_from:
			try:
				old_master_data = frappe.get_doc("Master Data", self.amended_from)
				if old_master_data.taxi_po_name:
					old_po = frappe.get_doc("Purchase Order", old_master_data.taxi_po_name)
					if old_po.docstatus == 2:  # Cancelled
						# Create amended PO
						amended_po = frappe.copy_doc(old_po)
						amended_po.amended_from = old_po.name
						amended_po.insert()
						self.taxi_po_name = amended_po.name
			except frappe.DoesNotExistError:
				pass

		# Handle Crusher PO amendment
		if self.crusher_po_name and self.amended_from:
			try:
				old_master_data = frappe.get_doc("Master Data", self.amended_from)
				if old_master_data.crusher_po_name:
					old_po = frappe.get_doc("Purchase Order", old_master_data.crusher_po_name)
					if old_po.docstatus == 2:  # Cancelled
						# Create amended PO
						amended_po = frappe.copy_doc(old_po)
						amended_po.amended_from = old_po.name
						amended_po.insert()
						self.crusher_po_name = amended_po.name
			except frappe.DoesNotExistError:
				pass

		# Handle Delivery Note amendment
		if self.delivery_note_name and self.amended_from:
			try:
				old_master_data = frappe.get_doc("Master Data", self.amended_from)
				if old_master_data.delivery_note_name:
					old_dn = frappe.get_doc("Delivery Note", old_master_data.delivery_note_name)
					if old_dn.docstatus == 2:  # Cancelled
						# Create amended DN
						amended_dn = frappe.copy_doc(old_dn)
						amended_dn.amended_from = old_dn.name
						amended_dn.insert()
						self.delivery_note_name = amended_dn.name
			except frappe.DoesNotExistError:
				pass

	def create_or_update_purchase_order(self, supplier, transaction_date, items, taxes, grand_total, field_name):
		"""Create or update Purchase Order document"""
		po_name = self.get(field_name)

		if po_name:
			# Update existing PO
			try:
				po_doc = frappe.get_doc("Purchase Order", po_name)
				if po_doc.docstatus == 1:
					frappe.throw(_("Cannot update submitted Purchase Order {0}").format(po_name))

				# Update fields
				po_doc.supplier = supplier
				po_doc.transaction_date = transaction_date
				po_doc.schedule_date = transaction_date
				po_doc.company = self.company
				po_doc.currency = get_company_currency(self.company)
				po_doc.conversion_rate = 1.0
				po_doc.disable_rounded_total = 1
				po_doc.project = self.project

				# Clear existing items and taxes
				po_doc.items = []
				po_doc.taxes = []

				# Add items
				for item in items:
					po_item = po_doc.append("items", {})
					for field, value in item.as_dict().items():
						if field not in ["name", "owner", "creation", "modified", "modified_by", "parent", "parentfield", "parenttype", "doctype", "idx"]:
							po_item.set(field, value)

				# Add taxes
				for tax in taxes:
					po_tax = po_doc.append("taxes", {})
					for field, value in tax.as_dict().items():
						if field not in ["name", "owner", "creation", "modified", "modified_by", "parent", "parentfield", "parenttype", "doctype", "idx"]:
							po_tax.set(field, value)

				po_doc.flags.ignore_validate = True
				po_doc.save()
				return po_doc.name

			except frappe.DoesNotExistError:
				# PO doesn't exist, create new one
				po_name = None

		if not po_name:
			# Create new PO
			po_doc = frappe.new_doc("Purchase Order")
			po_doc.supplier = supplier
			po_doc.transaction_date = transaction_date
			po_doc.schedule_date = transaction_date
			po_doc.company = self.company
			po_doc.currency = get_company_currency(self.company)
			po_doc.conversion_rate = 1.0
			po_doc.disable_rounded_total = 1
			po_doc.project = self.project

			# Add items
			for item in items:
				po_item = po_doc.append("items", {})
				for field, value in item.as_dict().items():
					if field not in ["name", "owner", "creation", "modified", "modified_by", "parent", "parentfield", "parenttype", "doctype", "idx"]:
						po_item.set(field, value)

			# Add taxes
			for tax in taxes:
				po_tax = po_doc.append("taxes", {})
				for field, value in tax.as_dict().items():
					if field not in ["name", "owner", "creation", "modified", "modified_by", "parent", "parentfield", "parenttype", "doctype", "idx"]:
						po_tax.set(field, value)

			po_doc.flags.ignore_validate = True
			po_doc.insert()
			self.set(field_name, po_doc.name)
			return po_doc.name

	def create_or_update_delivery_note(self):
		"""Create or update Delivery Note document"""
		dn_name = self.delivery_note_name

		if dn_name:
			# Update existing DN
			try:
				dn_doc = frappe.get_doc("Delivery Note", dn_name)
				if dn_doc.docstatus == 1:
					frappe.throw(_("Cannot update submitted Delivery Note {0}").format(dn_name))

				# Update fields
				company_currency = get_company_currency(self.company)
				# Get default selling price list from Selling Settings
				default_price_list = frappe.db.get_single_value("Selling Settings", "selling_price_list")
				
				dn_doc.customer = self.customer
				dn_doc.posting_date = self.date
				dn_doc.posting_time = self.time or "00:00:00"
				dn_doc.company = self.company
				dn_doc.currency = company_currency
				dn_doc.conversion_rate = 1.0
				dn_doc.selling_price_list = default_price_list  # Set default, but ignore_pricing_rule will bypass it
				dn_doc.price_list_currency = company_currency
				dn_doc.plc_conversion_rate = 1.0
				dn_doc.ignore_pricing_rule = 1  # Ignore price list, user enters rates manually
				dn_doc.disable_rounded_total = 1
				dn_doc.project = self.project

				# Clear existing items and taxes
				dn_doc.items = []
				dn_doc.taxes = []

				# Add items
				for item in self.items:
					dn_item = dn_doc.append("items", {})
					for field, value in item.as_dict().items():
						if field not in ["name", "owner", "creation", "modified", "modified_by", "parent", "parentfield", "parenttype", "doctype", "idx"]:
							dn_item.set(field, value)

				# Add taxes
				for tax in self.taxes:
					dn_tax = dn_doc.append("taxes", {})
					for field, value in tax.as_dict().items():
						if field not in ["name", "owner", "creation", "modified", "modified_by", "parent", "parentfield", "parenttype", "doctype", "idx"]:
							dn_tax.set(field, value)

				dn_doc.flags.ignore_validate = True
				dn_doc.save()
				return dn_doc.name

			except frappe.DoesNotExistError:
				# DN doesn't exist, create new one
				dn_name = None

		if not dn_name:
			# Create new DN
			company_currency = get_company_currency(self.company)
			# Get default selling price list from Selling Settings
			default_price_list = frappe.db.get_single_value("Selling Settings", "selling_price_list")
			
			dn_doc = frappe.new_doc("Delivery Note")
			dn_doc.customer = self.customer
			dn_doc.posting_date = self.date
			dn_doc.posting_time = self.time or "00:00:00"
			dn_doc.company = self.company
			dn_doc.currency = company_currency
			dn_doc.conversion_rate = 1.0
			dn_doc.selling_price_list = default_price_list  # Set default, but ignore_pricing_rule will bypass it
			dn_doc.price_list_currency = company_currency
			dn_doc.plc_conversion_rate = 1.0
			dn_doc.ignore_pricing_rule = 1  # Ignore price list, user enters rates manually
			dn_doc.disable_rounded_total = 1
			dn_doc.project = self.project

			# Add items
			for item in self.items:
				dn_item = dn_doc.append("items", {})
				for field, value in item.as_dict().items():
					if field not in ["name", "owner", "creation", "modified", "modified_by", "parent", "parentfield", "parenttype", "doctype", "idx"]:
						dn_item.set(field, value)

			# Add taxes
			for tax in self.taxes:
				dn_tax = dn_doc.append("taxes", {})
				for field, value in tax.as_dict().items():
					if field not in ["name", "owner", "creation", "modified", "modified_by", "parent", "parentfield", "parenttype", "doctype", "idx"]:
						dn_tax.set(field, value)

			dn_doc.flags.ignore_validate = True
			dn_doc.insert()
			self.delivery_note_name = dn_doc.name
			return dn_doc.name


# Hook functions for doc_events
# Note: These hooks are called in addition to the Document class methods
# The Document class methods (validate, before_save, etc.) are called automatically by Frappe
# These hook functions provide additional extensibility points
def validate_master_data(doc, method):
	"""Hook function for validate event - called after doc.validate()"""
	# Additional validation logic can be added here if needed
	pass


def before_save_master_data(doc, method):
	"""Hook function for before_save event - called after doc.before_save()"""
	# Additional before_save logic can be added here if needed
	pass


def on_submit_master_data(doc, method):
	"""Hook function for on_submit event - called after doc.on_submit()"""
	# Additional on_submit logic can be added here if needed
	pass


def on_cancel_master_data(doc, method):
	"""Hook function for on_cancel event - called after doc.on_cancel()"""
	# Additional on_cancel logic can be added here if needed
	pass


def on_update_after_submit_master_data(doc, method):
	"""Hook function for on_update_after_submit event - called after doc.on_update_after_submit()"""
	# Additional on_update_after_submit logic can be added here if needed
	pass
