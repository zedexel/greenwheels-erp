# Copyright (c) 2026, ZedeXeL and contributors
# For license information, please see license.txt

import frappe
import json
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt, getdate
from erpnext import get_company_currency
from erpnext.controllers.taxes_and_totals import calculate_taxes_and_totals


class MasterData(Document):
	def validate(self):
		"""Validate Master Data document"""
		# Handle amendments FIRST - create amended versions of linked documents if they're cancelled
		# This must happen before link validation to prevent "Cannot link cancelled document" errors
		if self.amended_from:
			# Temporarily ignore link validation while we fix cancelled links
			self.flags.ignore_links = True
			try:
				self.handle_amendment_linked_documents()
			finally:
				# Re-enable link validation after fixing links
				self.flags.ignore_links = False

		# Get company currency for use in child documents
		if self.company:
			self._company_currency = get_company_currency(self.company)
		else:
			self._company_currency = None

		# Set disable_rounded_total to prevent rounding (if field exists)
		if hasattr(self, "disable_rounded_total"):
			if self.disable_rounded_total != 1:
				self.disable_rounded_total = 1

		# Always-required fields (even for drafts)
		if not self.company:
			frappe.throw(_("Company is mandatory"))

		# Project must always be set so naming/links are consistent
		if not self.project:
			frappe.throw(_("Project is mandatory"))

		# Extra mandatory checks only when submitting
		if getattr(self, "_action", None) == "submit":
			self.validate_for_submit()

	def validate_for_submit(self):
		"""Validation that should run only when submitting Master Data."""
		# Taxi / delivery note header
		if not self.taxi:
			frappe.throw(_("Taxi Supplier is mandatory"))

		if not self.taxi_date:
			frappe.throw(_("Taxi Date is mandatory"))

		if not self.customer:
			frappe.throw(_("Customer is mandatory"))

		if not self.date:
			frappe.throw(_("Delivery Note Date is mandatory"))

		# Validate Taxi PO items exist
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

		# Validate Delivery Note items exist
		if not self.items or len(self.items) == 0:
			frappe.throw(_("Please add at least one item in Delivery Note"))

		# Validate Petty Cash fields when Crusher payment is Cash.
		if not self.crusher_included and getattr(self, "custom_payment", None) == "Cash":
			if not getattr(self, "crusher_petty_cash_account", None):
				frappe.throw(_("Petty Cash Account is mandatory when Crusher Payment type is Cash."))
			if not getattr(self, "crusher_petty_cash_account_head", None):
				frappe.throw(_("Petty Cash Account Head is mandatory when Crusher Payment type is Cash."))

		# Validate petty cash fields for Taxi Tax rows marked for cash payment.
		# Petty Cash Account and Account Head are shared parent-level fields, not per-row.
		taxi_petty_cash_rows = [t for t in (self.taxi_taxes or []) if t.get("custom_is_petty_cash")]
		if taxi_petty_cash_rows:
			if not getattr(self, "taxi_petty_cash_account", None):
				frappe.throw(
					_("Petty Cash Account is mandatory when any Taxi Tax row has 'Pay via Petty Cash' checked.")
				)
			if not getattr(self, "taxi_petty_cash_account_head", None):
				frappe.throw(
					_("Petty Cash Account Head is mandatory when any Taxi Tax row has 'Pay via Petty Cash' checked.")
				)
			for tax_row in taxi_petty_cash_rows:
				if flt(tax_row.get("tax_amount", 0)) <= 0:
					frappe.throw(
						_("Taxi Tax row {0}: Tax Amount must be greater than zero for Petty Cash payment.").format(
							tax_row.idx
						)
					)

	def calculate_taxi_po_totals(self):
		"""Calculate taxes and totals for Taxi PO section"""
		if not self.taxi_items or len(self.taxi_items) == 0:
			self.taxi_grand_total = 0
			return

		# Create a temporary Purchase Order document for calculation
		temp_doc = frappe.new_doc("Purchase Order")
		temp_doc.company = self.company
		temp_doc.currency = get_company_currency(self.company)
		temp_doc.conversion_rate = 1.0
		temp_doc.disable_rounded_total = 1
		
		# Copy items
		for item in self.taxi_items:
			po_item = temp_doc.append("items", {})
			for field, value in item.as_dict().items():
				if field not in ["name", "owner", "creation", "modified", "modified_by", "parent", "parentfield", "parenttype", "doctype", "idx"]:
					po_item.set(field, value)
		
		# Copy taxes
		for tax in (self.taxi_taxes or []):
			po_tax = temp_doc.append("taxes", {})
			for field, value in tax.as_dict().items():
				if field not in ["name", "owner", "creation", "modified", "modified_by", "parent", "parentfield", "parenttype", "doctype", "idx"]:
					po_tax.set(field, value)
		
		# Calculate taxes and totals
		try:
			temp_doc.flags.ignore_validate = True
			calculate_taxes_and_totals(temp_doc)
			self.taxi_grand_total = temp_doc.grand_total or temp_doc.net_total or 0
		except Exception as e:
			frappe.log_error(f"Error calculating taxi PO totals: {str(e)}")
			# Fallback: calculate simple total
			self.taxi_grand_total = sum(flt(item.net_amount or item.amount or 0) for item in self.taxi_items)
			if self.taxi_taxes:
				for tax in self.taxi_taxes:
					if tax.charge_type == "On Net Total":
						tax_amount = flt(tax.rate or 0) / 100 * self.taxi_grand_total
					elif tax.charge_type == "Actual":
						tax_amount = flt(tax.tax_amount or 0)
					else:
						tax_amount = 0
					self.taxi_grand_total += tax_amount

	def calculate_crusher_po_totals(self):
		"""Calculate taxes and totals for Crusher PO section"""
		if not self.crusher_items or len(self.crusher_items) == 0:
			self.crusher_grand_total = 0
			return

		# Create a temporary Purchase Order document for calculation
		temp_doc = frappe.new_doc("Purchase Order")
		temp_doc.company = self.company
		temp_doc.currency = get_company_currency(self.company)
		temp_doc.conversion_rate = 1.0
		temp_doc.disable_rounded_total = 1
		
		# Copy items
		for item in self.crusher_items:
			po_item = temp_doc.append("items", {})
			for field, value in item.as_dict().items():
				if field not in ["name", "owner", "creation", "modified", "modified_by", "parent", "parentfield", "parenttype", "doctype", "idx"]:
					po_item.set(field, value)
		
		# Copy taxes
		for tax in (self.crusher_taxes or []):
			po_tax = temp_doc.append("taxes", {})
			for field, value in tax.as_dict().items():
				if field not in ["name", "owner", "creation", "modified", "modified_by", "parent", "parentfield", "parenttype", "doctype", "idx"]:
					po_tax.set(field, value)
		
		# Calculate taxes and totals
		try:
			temp_doc.flags.ignore_validate = True
			calculate_taxes_and_totals(temp_doc)
			self.crusher_grand_total = temp_doc.grand_total or temp_doc.net_total or 0
		except Exception as e:
			frappe.log_error(f"Error calculating crusher PO totals: {str(e)}")
			# Fallback: calculate simple total
			self.crusher_grand_total = sum(flt(item.net_amount or item.amount or 0) for item in self.crusher_items)
			if self.crusher_taxes:
				for tax in self.crusher_taxes:
					if tax.charge_type == "On Net Total":
						tax_amount = flt(tax.rate or 0) / 100 * self.crusher_grand_total
					elif tax.charge_type == "Actual":
						tax_amount = flt(tax.tax_amount or 0)
					else:
						tax_amount = 0
					self.crusher_grand_total += tax_amount

	def calculate_delivery_note_totals(self):
		"""Calculate taxes and totals for Delivery Note section"""
		if not self.items or len(self.items) == 0:
			self.do_grand_total = 0
			return

		# Create a temporary Delivery Note document for calculation
		temp_doc = frappe.new_doc("Delivery Note")
		temp_doc.company = self.company
		temp_doc.currency = get_company_currency(self.company)
		temp_doc.conversion_rate = 1.0
		temp_doc.disable_rounded_total = 1
		
		# Copy items
		for item in self.items:
			dn_item = temp_doc.append("items", {})
			for field, value in item.as_dict().items():
				if field not in ["name", "owner", "creation", "modified", "modified_by", "parent", "parentfield", "parenttype", "doctype", "idx"]:
					dn_item.set(field, value)
		
		# Copy taxes
		for tax in (self.taxes or []):
			dn_tax = temp_doc.append("taxes", {})
			for field, value in tax.as_dict().items():
				if field not in ["name", "owner", "creation", "modified", "modified_by", "parent", "parentfield", "parenttype", "doctype", "idx"]:
					dn_tax.set(field, value)
		
		# Calculate taxes and totals
		try:
			temp_doc.flags.ignore_validate = True
			calculate_taxes_and_totals(temp_doc)
			self.do_grand_total = temp_doc.grand_total or temp_doc.net_total or 0
		except Exception as e:
			frappe.log_error(f"Error calculating delivery note totals: {str(e)}")
			# Fallback: calculate simple total
			self.do_grand_total = sum(flt(item.net_amount or item.amount or 0) for item in self.items)
			if self.taxes:
				for tax in self.taxes:
					if tax.charge_type == "On Net Total":
						tax_amount = flt(tax.rate or 0) / 100 * self.do_grand_total
					elif tax.charge_type == "Actual":
						tax_amount = flt(tax.tax_amount or 0)
					else:
						tax_amount = 0
					self.do_grand_total += tax_amount

	def before_save(self):
		"""Hook before every save.

		No linked Purchase Orders or Delivery Note are created while the
		document is in draft. Linked documents are created/updated in
		before_submit instead. We still normalise tax tables here so that
		child rows can be saved without DB errors.
		"""
		# Convert item_wise_tax_detail from dict to JSON string for all tax tables.
		# This is required because Frappe stores this field as JSON in the database.
		for tax_table in [self.taxi_taxes, self.crusher_taxes, self.taxes]:
			if tax_table:
				for tax in tax_table:
					if tax.get("item_wise_tax_detail") and isinstance(tax.item_wise_tax_detail, dict):
						tax.item_wise_tax_detail = json.dumps(tax.item_wise_tax_detail, separators=(",", ":"))

	def before_submit(self):
		"""Before submitting Master Data, create or update linked POs and Delivery Note."""
		# Note: Amendment handling is done in validate() to prevent link validation errors
		# Convert item_wise_tax_detail from dict to JSON string for all tax tables
		# This is required because Frappe stores this field as JSON in the database
		for tax_table in [self.taxi_taxes, self.crusher_taxes, self.taxes]:
			if tax_table:
				for tax in tax_table:
					if tax.get("item_wise_tax_detail") and isinstance(tax.item_wise_tax_detail, dict):
						tax.item_wise_tax_detail = json.dumps(tax.item_wise_tax_detail, separators=(",", ":"))

		# Calculate totals for all sections first
		self.calculate_taxi_po_totals()
		if not self.crusher_included:
			self.calculate_crusher_po_totals()
		self.calculate_delivery_note_totals()

		# Create/update Taxi Purchase Order
		self.create_or_update_purchase_order(
			supplier=self.taxi,
			transaction_date=self.taxi_date,
			items=self.taxi_items,
			taxes=self.taxi_taxes,
			grand_total=self.taxi_grand_total,
			field_name="taxi_po_name",
			invoice=getattr(self, "taxi_invoice", None),
			invoice_date=getattr(self, "taxi_invoice_date", None),
			reference=None,
			attachment=getattr(self, "taxi_attachement", None),
			po_type="Taxi",
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
				invoice=None,
				invoice_date=None,
				reference=getattr(self, "crusher_reference", None),
				attachment=getattr(self, "crusher_attachement", None),
				po_type="Crusher",
				custom_payment=getattr(self, "custom_payment", None),
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

		# Create and submit Petty Cash Entry for Crusher cash payment.
		if not self.crusher_included and getattr(self, "custom_payment", None) == "Cash":
			self._create_crusher_petty_cash_entry()

		# Create and submit Petty Cash Entries for Taxi tax rows marked as cash payment.
		self._create_taxi_tax_petty_cash_entries()

	def on_cancel(self):
		"""Cancel linked Purchase Orders and Delivery Note"""
		# Cancel Petty Cash Entries created from Taxi tax rows.
		for tax_row in (self.taxi_taxes or []):
			pce_name = tax_row.get("custom_petty_cash_entry")
			if pce_name:
				try:
					pce_doc = frappe.get_doc("Petty Cash Entry", pce_name)
					if pce_doc.docstatus == 1:
						pce_doc.cancel()
				except frappe.DoesNotExistError:
					pass

		# Cancel Crusher Petty Cash Entry first (before cancelling the PO).
		if getattr(self, "crusher_petty_cash_entry", None):
			try:
				pce_doc = frappe.get_doc("Petty Cash Entry", self.crusher_petty_cash_entry)
				if pce_doc.docstatus == 1:
					pce_doc.cancel()
			except frappe.DoesNotExistError:
				pass

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

	def handle_amendment_linked_documents(self):
		"""Handle amendments - create amended versions of linked documents if they're cancelled"""
		# Handle Taxi PO amendment
		if self.taxi_po_name:
			try:
				old_po = frappe.get_doc("Purchase Order", self.taxi_po_name)
				# If PO is cancelled, create amended version
				if old_po.docstatus == 2:  # Cancelled (2)
					# Check if amended version already exists
					amended_po_name = frappe.db.get_value("Purchase Order", {"amended_from": old_po.name}, "name")
					if amended_po_name:
						self.taxi_po_name = amended_po_name
					else:
						# Create amended PO
						amended_po = frappe.copy_doc(old_po)
						amended_po.amended_from = old_po.name
						amended_po.flags.ignore_validate = True
						amended_po.flags.ignore_links = True  # Prevent link validation errors
						amended_po.insert()
						self.taxi_po_name = amended_po.name
			except (frappe.DoesNotExistError, frappe.LinkExistsError, frappe.CancelledLinkError):
				pass

		# Handle Crusher PO amendment
		if self.crusher_po_name:
			try:
				old_po = frappe.get_doc("Purchase Order", self.crusher_po_name)
				# If PO is cancelled, create amended version
				if old_po.docstatus == 2:  # Cancelled (2)
					# Check if amended version already exists
					amended_po_name = frappe.db.get_value("Purchase Order", {"amended_from": old_po.name}, "name")
					if amended_po_name:
						self.crusher_po_name = amended_po_name
					else:
						# Create amended PO
						amended_po = frappe.copy_doc(old_po)
						amended_po.amended_from = old_po.name
						amended_po.flags.ignore_validate = True
						amended_po.flags.ignore_links = True  # Prevent link validation errors
						amended_po.insert()
						self.crusher_po_name = amended_po.name
			except (frappe.DoesNotExistError, frappe.LinkExistsError, frappe.CancelledLinkError):
				pass

		# Handle Delivery Note amendment
		if self.delivery_note_name:
			try:
				old_dn = frappe.get_doc("Delivery Note", self.delivery_note_name)
				# If DN is cancelled, create amended version
				if old_dn.docstatus == 2:  # Cancelled (2)
					# Check if amended version already exists
					amended_dn_name = frappe.db.get_value("Delivery Note", {"amended_from": old_dn.name}, "name")
					if amended_dn_name:
						self.delivery_note_name = amended_dn_name
					else:
						# Create amended DN
						amended_dn = frappe.copy_doc(old_dn)
						amended_dn.amended_from = old_dn.name
						amended_dn.flags.ignore_validate = True
						amended_dn.flags.ignore_links = True  # Prevent link validation errors
						amended_dn.insert()
						self.delivery_note_name = amended_dn.name
			except (frappe.DoesNotExistError, frappe.LinkExistsError, frappe.CancelledLinkError):
				pass

	def on_update_after_submit(self):
		"""Handle amendments after submit - this is called when updating an already submitted document"""
		# Amendments are now handled in before_save, but keep this for any additional logic needed
		pass

	def _create_crusher_petty_cash_entry(self):
		"""Create and submit a Petty Cash Debit entry for a Crusher cash payment."""
		amount = flt(self.crusher_grand_total)
		if amount <= 0:
			frappe.throw(
				_("Crusher Grand Total must be greater than zero to create a Petty Cash Entry.")
			)

		pce = frappe.new_doc("Petty Cash Entry")
		pce.posting_date = self.crusher_date or frappe.utils.today()
		pce.petty_cash_account = self.crusher_petty_cash_account
		pce.entry_type = "Debit"
		pce.amount = amount
		pce.account_head = self.crusher_petty_cash_account_head
		# grand_total == amount; basic_amount will auto-set in PCE validate (vat_amount == 0).
		pce.grand_total = amount
		pce.basic_amount = amount
		pce.vat_amount = 0
		pce.company = self.company
		pce.invoice_voucher = getattr(self, "crusher_reference", "") or ""
		pce.vendor_company_name = self.crusher
		item_names = ", ".join(
			row.item_name or row.item_code or ""
			for row in (self.crusher_items or [])
			if row.item_name or row.item_code
		)
		pce.description = _("Cash paid for {0} to {1}").format(item_names or _("items"), self.crusher or "")
		pce.remarks = _("Auto-created from Master Data {0} on submit.").format(self.name)

		pce.insert(ignore_permissions=True)
		pce.submit()

		self.db_set("crusher_petty_cash_entry", pce.name, notify=True)
		frappe.msgprint(
			_("Petty Cash Entry {0} created — {1} deducted from {2}.").format(
				frappe.utils.get_link_to_form("Petty Cash Entry", pce.name),
				frappe.format(amount, {"fieldtype": "Currency"}),
				frappe.bold(self.crusher_petty_cash_account),
			),
			alert=True,
			indicator="green",
		)

	def _create_taxi_tax_petty_cash_entries(self):
		"""Create and submit a Petty Cash Debit entry for each Taxi tax row marked as cash payment.

		Petty Cash Account and Account Head are taken from the parent-level fields
		taxi_petty_cash_account and taxi_petty_cash_account_head, which are shared
		across all petty cash rows in the taxi taxes table.
		"""
		petty_cash_account = getattr(self, "taxi_petty_cash_account", None)
		petty_cash_account_head = getattr(self, "taxi_petty_cash_account_head", None)

		for tax_row in (self.taxi_taxes or []):
			if not tax_row.get("custom_is_petty_cash"):
				continue

			amount = flt(tax_row.tax_amount)
			# Guard — validation already ran but protect against edge cases.
			if amount <= 0:
				continue

			pce = frappe.new_doc("Petty Cash Entry")
			pce.posting_date = self.taxi_date or frappe.utils.today()
			pce.petty_cash_account = petty_cash_account
			pce.entry_type = "Debit"
			pce.amount = amount
			pce.account_head = petty_cash_account_head
			# grand_total == amount; basic_amount auto-sets in PCE validate (vat_amount == 0).
			pce.grand_total = amount
			pce.basic_amount = amount
			pce.vat_amount = 0
			pce.company = self.company
			pce.invoice_voucher = getattr(self, "taxi_invoice", "") or ""
			pce.vendor_company_name = self.taxi
			pce.description = _("{0} Paid at {1}").format(
				tax_row.account_head or tax_row.description or _("Tax"),
				self.crusher or "",
			)
			pce.remarks = _("Auto-created from Master Data {0}, Taxi Tax row {1}.").format(
				self.name, tax_row.idx
			)

			pce.insert(ignore_permissions=True)
			pce.submit()

			# Store the PCE name on the tax row for tracking and cancellation.
			frappe.db.set_value(
				"Purchase Taxes and Charges",
				tax_row.name,
				"custom_petty_cash_entry",
				pce.name,
			)

			frappe.msgprint(
				_("Petty Cash Entry {0} created for Taxi Tax row {1} — {2} deducted from {3}.").format(
					frappe.utils.get_link_to_form("Petty Cash Entry", pce.name),
					tax_row.idx,
					frappe.format(amount, {"fieldtype": "Currency"}),
					frappe.bold(petty_cash_account),
				),
				alert=True,
				indicator="green",
			)

	def create_or_update_purchase_order(
		self,
		supplier,
		transaction_date,
		items,
		taxes,
		grand_total,
		field_name,
		invoice=None,
		invoice_date=None,
		reference=None,
		attachment=None,
		po_type=None,
		custom_payment=None,
	):
		"""Create or update Purchase Order document.

		po_type is an optional flag used to set custom_purchase_order_type
		on the Purchase Order (e.g. \"Taxi\" or \"Crusher\").
		custom_payment is passed from Master Data (e.g. crusher tab) to Purchase Order.
		"""
		po_name = self.get(field_name)

		if po_name:
			# Update existing PO
			try:
				po_doc = frappe.get_doc("Purchase Order", po_name)
				if po_doc.docstatus == 2:
					# PO is cancelled - this should have been handled in handle_amendment_linked_documents
					# But if we get here, create amended version
					amended_po = frappe.copy_doc(po_doc)
					amended_po.amended_from = po_doc.name
					amended_po.flags.ignore_validate = True
					amended_po.insert()
					po_name = amended_po.name
					self.set(field_name, po_name)
					po_doc = amended_po
				elif po_doc.docstatus == 1:
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
				
				# Map new fields from Master Data -> custom fields on Purchase Order
				if invoice is not None:
					po_doc.custom_supplier_invoice = invoice
				if invoice_date is not None:
					po_doc.custom_supplier_invoice_date = invoice_date
				if reference is not None:
					po_doc.custom_supplier_reference = reference
				if attachment is not None:
					po_doc.custom_supplier_attachment = attachment

				# Distinguish between Taxi / Crusher purchase orders if requested
				if po_type is not None:
					po_doc.custom_purchase_order_type = po_type

				if custom_payment is not None:
					po_doc.custom_payment = custom_payment

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

				# Calculate taxes and totals on PO
				po_doc.flags.ignore_validate = True
				po_doc.calculate_taxes_and_totals()
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
			
			# Map new fields from Master Data -> custom fields on Purchase Order
			if invoice is not None:
				po_doc.custom_supplier_invoice = invoice
			if invoice_date is not None:
				po_doc.custom_supplier_invoice_date = invoice_date
			if reference is not None:
				po_doc.custom_supplier_reference = reference
			if attachment is not None:
				po_doc.custom_supplier_attachment = attachment

			# Distinguish between Taxi / Crusher purchase orders if requested
			if po_type is not None:
				po_doc.custom_purchase_order_type = po_type

			if custom_payment is not None:
				po_doc.custom_payment = custom_payment

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

			# Calculate taxes and totals on PO
			po_doc.flags.ignore_validate = True
			po_doc.calculate_taxes_and_totals()
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
				if dn_doc.docstatus == 2:
					# DN is cancelled - this should have been handled in handle_amendment_linked_documents
					# But if we get here, create amended version
					amended_dn = frappe.copy_doc(dn_doc)
					amended_dn.amended_from = dn_doc.name
					amended_dn.flags.ignore_validate = True
					amended_dn.insert()
					dn_name = amended_dn.name
					self.delivery_note_name = dn_name
					dn_doc = amended_dn
				elif dn_doc.docstatus == 1:
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
				
				# Map new fields from Master Data -> custom fields on Delivery Note
				if hasattr(self, 'do_number') and self.do_number:
					dn_doc.custom_do_number = self.do_number
				if hasattr(self, 'vehicle_number') and self.vehicle_number:
					dn_doc.vehicle_no = self.vehicle_number
				if hasattr(self, 'do_attachement') and self.do_attachement:
					dn_doc.custom_do_attachment = self.do_attachement

				# Clear existing items and taxes
				dn_doc.items = []
				dn_doc.taxes = []

				# Add items
				for item in self.items:
					dn_item = dn_doc.append("items", {})
					item_dict = item.as_dict()
					for field, value in item_dict.items():
						# Exclude system fields and dummy fields (we'll handle dummy fields separately)
						if field not in ["name", "owner", "creation", "modified", "modified_by", "parent", "parentfield", "parenttype", "doctype", "idx", 
										"custom_sales_order_against_dummy", "custom_against_sales_order_item_dummy"]:
							dn_item.set(field, value)
					
					# Copy from dummy fields to actual fields to prevent double counting
					if item_dict.get("custom_sales_order_against_dummy"):
						dn_item.against_sales_order = item_dict.get("custom_sales_order_against_dummy")
					if item_dict.get("custom_against_sales_order_item_dummy"):
						dn_item.so_detail = item_dict.get("custom_against_sales_order_item_dummy")

				# Add taxes
				for tax in self.taxes:
					dn_tax = dn_doc.append("taxes", {})
					for field, value in tax.as_dict().items():
						if field not in ["name", "owner", "creation", "modified", "modified_by", "parent", "parentfield", "parenttype", "doctype", "idx"]:
							dn_tax.set(field, value)

				# Calculate taxes and totals on DN
				dn_doc.flags.ignore_validate = True
				dn_doc.calculate_taxes_and_totals()
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
			
			# Map new fields from Master Data -> custom fields on Delivery Note
			if hasattr(self, 'do_number') and self.do_number:
				dn_doc.custom_do_number = self.do_number
			if hasattr(self, 'vehicle_number') and self.vehicle_number:
				dn_doc.vehicle_no = self.vehicle_number
			if hasattr(self, 'do_attachement') and self.do_attachement:
				dn_doc.custom_do_attachment = self.do_attachement

			# Add items
			for item in self.items:
				dn_item = dn_doc.append("items", {})
				item_dict = item.as_dict()
				for field, value in item_dict.items():
					# Exclude system fields and dummy fields (we'll handle dummy fields separately)
					if field not in ["name", "owner", "creation", "modified", "modified_by", "parent", "parentfield", "parenttype", "doctype", "idx",
									"custom_sales_order_against_dummy", "custom_against_sales_order_item_dummy"]:
						dn_item.set(field, value)
				
				# Copy from dummy fields to actual fields to prevent double counting
				if item_dict.get("custom_sales_order_against_dummy"):
					dn_item.against_sales_order = item_dict.get("custom_sales_order_against_dummy")
				if item_dict.get("custom_against_sales_order_item_dummy"):
					dn_item.so_detail = item_dict.get("custom_against_sales_order_item_dummy")

			# Add taxes
			for tax in self.taxes:
				dn_tax = dn_doc.append("taxes", {})
				for field, value in tax.as_dict().items():
					if field not in ["name", "owner", "creation", "modified", "modified_by", "parent", "parentfield", "parenttype", "doctype", "idx"]:
						dn_tax.set(field, value)

			# Calculate taxes and totals on DN
			dn_doc.flags.ignore_validate = True
			dn_doc.calculate_taxes_and_totals()
			dn_doc.insert()
			self.delivery_note_name = dn_doc.name
			return dn_doc.name


@frappe.whitelist()
def make_delivery_note_from_sales_order(source_name, target_doc=None, kwargs=None):
	"""
	Custom method to map Sales Order items to Master Data items.
	Similar to erpnext.selling.doctype.sales_order.sales_order.make_delivery_note
	but adapted for Master Data which doesn't have packed_items.
	"""
	from frappe.model.mapper import get_mapped_doc
	from erpnext.stock.get_item_details import get_item_defaults, get_item_group_defaults
	from frappe.utils import flt, cint, cstr

	if not kwargs:
		kwargs = {}
	kwargs = frappe._dict(kwargs)

	# Check if Sales Order exists and is submitted
	so = frappe.get_doc("Sales Order", source_name)
	if so.docstatus != 1:
		frappe.throw(_("Sales Order must be submitted"))

	has_unit_price_items = so.has_unit_price_items

	def is_unit_price_row(source):
		return has_unit_price_items and source.qty == 0

	def select_item(d):
		filtered_items = kwargs.get("filtered_children", [])
		child_filter = d.name in filtered_items if filtered_items else True
		return child_filter

	def condition(doc):
		# Only include items that haven't been fully delivered
		return (
			(abs(doc.delivered_qty) < abs(doc.qty)) or is_unit_price_row(doc)
		) and doc.delivered_by_supplier != 1

	def update_item(source, target, source_parent):
		# Calculate remaining qty
		remaining_qty = (
			flt(source.qty) if is_unit_price_row(source) else flt(source.qty) - flt(source.delivered_qty)
		)
		target.qty = remaining_qty
		
		# Calculate stock_qty (qty * conversion_factor)
		target.stock_qty = remaining_qty * flt(source.conversion_factor)
		
		# Calculate amounts
		target.base_amount = remaining_qty * flt(source.base_rate)
		target.amount = remaining_qty * flt(source.rate)
		target.base_rate = flt(source.base_rate)
		target.rate = flt(source.rate)
		
		# Calculate net amounts (after discount)
		target.net_amount = target.amount - flt(target.discount_amount or 0)
		target.base_net_amount = target.base_amount - flt(target.discount_amount or 0)

		# Set cost center from project or item defaults
		item = get_item_defaults(target.item_code, source_parent.company)
		item_group = get_item_group_defaults(target.item_code, source_parent.company)

		if item:
			target.cost_center = (
				frappe.db.get_value("Project", source_parent.project, "cost_center")
				or item.get("selling_cost_center")
				or item_group.get("selling_cost_center")
			)

		# Set Sales Order references in dummy fields to prevent double counting
		# These will be copied to actual fields when creating the Delivery Note
		target.custom_sales_order_against_dummy = source_parent.name
		target.custom_against_sales_order_item_dummy = source.name
		# Clear actual fields to prevent double counting
		target.against_sales_order = None
		target.so_detail = None

	# Mapper: Only map Sales Order Items, NOT taxes or other child tables
	mapper = {
		"Sales Order": {
			"doctype": "Master Data",
			# No field_map needed - we're just updating the existing Master Data doc
		},
		"Sales Order Item": {
			"doctype": "Delivery Note Item",
			"field_map": {
				"rate": "rate",
				"name": "custom_against_sales_order_item_dummy",
				"parent": "custom_sales_order_against_dummy",
			},
			"condition": lambda d: condition(d) and select_item(d),
			"postprocess": update_item,
		},
		# Explicitly ignore taxes - get_mapped_doc auto-copies child tables with same fieldname/doctype
		"Sales Taxes and Charges": {
			"doctype": "Sales Taxes and Charges",
			"ignore": True,  # Prevent copying taxes from Sales Order
		},
		# Explicitly ignore Sales Team as well
		"Sales Team": {
			"doctype": "Sales Team",
			"ignore": True,  # Prevent copying sales team from Sales Order
		},
	}

	target_doc = get_mapped_doc("Sales Order", so.name, mapper, target_doc)

	# Set basic fields on target document
	if target_doc:
		if not target_doc.customer:
			target_doc.customer = so.customer
		if not target_doc.company:
			target_doc.company = so.company
		if not target_doc.project:
			target_doc.project = so.project

	return target_doc


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


@frappe.whitelist()
def create_amended_linked_document(doctype, source_name):
	"""
	Create an amended version of a linked document (Purchase Order or Delivery Note).
	This method is called from the frontend when Master Data is amended.
	"""
	if not doctype or not source_name:
		frappe.throw(_("Doctype and source name are required"))
	
	# Check if source document exists and is cancelled
	try:
		source_doc = frappe.get_doc(doctype, source_name)
		if source_doc.docstatus != 2:
			frappe.throw(_("Source document {0} is not cancelled").format(source_name))
		
		# Check if amended version already exists
		amended_name = frappe.db.get_value(doctype, {"amended_from": source_name}, "name")
		if amended_name:
			return {"name": amended_name, "already_exists": True}
		
		# Create amended version
		amended_doc = frappe.copy_doc(source_doc)
		amended_doc.amended_from = source_name
		amended_doc.flags.ignore_validate = True
		amended_doc.flags.ignore_links = True
		amended_doc.insert()
		
		return {"name": amended_doc.name, "already_exists": False}
		
	except frappe.DoesNotExistError:
		frappe.throw(_("Source document {0} does not exist").format(source_name))
	except Exception as e:
		frappe.log_error(f"Error creating amended {doctype}: {str(e)}")
		frappe.throw(_("Error creating amended document: {0}").format(str(e)))
