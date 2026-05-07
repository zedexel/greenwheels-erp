# Copyright (c) 2026, ZedeXeL and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt


class PettyCashEntry(Document):
	def validate(self):
		self.amount = flt(self.amount)
		self.basic_amount = flt(self.basic_amount)
		self.vat_amount = flt(self.vat_amount)
		self.grand_total = flt(self.grand_total)

		if not self.entry_type:
			frappe.throw(_("Entry Type is mandatory."))

		if self.amount <= 0:
			frappe.throw(_("Amount must be greater than zero."))

		account_doc = self._get_account_doc()
		if not account_doc.is_active:
			frappe.throw(_("Petty Cash Account {0} is inactive.").format(frappe.bold(account_doc.name)))

		if self.entry_type == "Debit":
			if not self.account_head:
				frappe.throw(_("Account Head is mandatory for Debit entries."))
			account_head_doc = frappe.get_doc("Petty Cash Account Head", self.account_head)
			if not account_head_doc.is_active:
				frappe.throw(
					_("Account Head {0} is inactive.").format(frappe.bold(account_head_doc.name))
				)

			# Keep totals coherent for one-line expense model.
			if self.grand_total <= 0:
				self.grand_total = self.amount
			if self.basic_amount <= 0 and self.vat_amount == 0:
				self.basic_amount = self.grand_total

			if round(self.grand_total, 2) != round(self.amount, 2):
				frappe.throw(_("Grand Total must match Amount for Debit entries."))

		elif self.entry_type == "Account to Account":
			if not self.to_petty_cash_account:
				frappe.throw(_("Transfer To Account is mandatory for Account to Account transfers."))
			if self.to_petty_cash_account == self.petty_cash_account:
				frappe.throw(_("Source and destination accounts cannot be the same."))

			dest_doc = frappe.get_doc("Petty Cash Account", self.to_petty_cash_account)
			if not dest_doc.is_active:
				frappe.throw(
					_("Destination account {0} is inactive.").format(frappe.bold(dest_doc.name))
				)

			self.account_head = None
			self.basic_amount = 0
			self.vat_amount = 0
			self.grand_total = 0

		else:
			# Topup — clear debit-specific fields.
			self.account_head = None
			self.to_petty_cash_account = None
			self.basic_amount = 0
			self.vat_amount = 0
			self.grand_total = 0

		if self.docstatus == 0 and self.entry_type in ("Debit", "Account to Account"):
			self._validate_available_balance(account_doc)

	def before_submit(self):
		account_doc = self._get_account_doc(for_update=True)

		if self.entry_type == "Account to Account":
			# Lock destination account to prevent concurrent balance updates.
			frappe.db.sql(
				"""select name from `tabPetty Cash Account` where name = %s for update""",
				(self.to_petty_cash_account,),
			)

		self._set_balance_snapshots(account_doc)
		self._validate_available_balance(account_doc)
		self._apply_balance_update(account_doc)

	def on_cancel(self):
		account_doc = self._get_account_doc(for_update=True)
		current_balance = flt(account_doc.current_balance)
		amount = flt(self.amount)

		if self.entry_type == "Topup":
			account_doc.current_balance = current_balance - amount

		elif self.entry_type == "Account to Account":
			# Reverse: restore source, deduct from destination.
			frappe.db.sql(
				"""select name from `tabPetty Cash Account` where name = %s for update""",
				(self.to_petty_cash_account,),
			)
			dest_doc = frappe.get_doc("Petty Cash Account", self.to_petty_cash_account)
			new_dest_balance = flt(dest_doc.current_balance) - amount
			if not dest_doc.allow_negative_balance and new_dest_balance < 0:
				frappe.throw(
					_(
						"Cannot cancel: reversing this transfer would make destination account {0} negative."
					).format(frappe.bold(dest_doc.name))
				)
			dest_doc.current_balance = new_dest_balance
			dest_doc.save(ignore_permissions=True)
			account_doc.current_balance = current_balance + amount

		else:
			# Debit reversal — restore balance.
			account_doc.current_balance = current_balance + amount

		if not account_doc.allow_negative_balance and flt(account_doc.current_balance) < 0:
			frappe.throw(_("Cannot cancel because it would make account balance negative."))

		account_doc.save(ignore_permissions=True)

	def _get_account_doc(self, for_update=False):
		if not self.petty_cash_account:
			frappe.throw(_("Petty Cash Account is mandatory."))

		if for_update:
			frappe.db.sql(
				"""select name from `tabPetty Cash Account` where name = %s for update""",
				(self.petty_cash_account,),
			)

		return frappe.get_doc("Petty Cash Account", self.petty_cash_account)

	def _set_balance_snapshots(self, account_doc):
		current_balance = flt(account_doc.current_balance)
		self.balance_before = current_balance

		if self.entry_type == "Topup":
			self.balance_after = current_balance + flt(self.amount)
		else:
			# Debit and Account to Account both reduce the source balance.
			self.balance_after = current_balance - flt(self.amount)

	def _validate_available_balance(self, account_doc):
		if self.entry_type not in ("Debit", "Account to Account"):
			return
		if account_doc.allow_negative_balance:
			return

		projected_balance = flt(account_doc.current_balance) - flt(self.amount)
		if projected_balance < 0:
			frappe.throw(
				_("Insufficient balance in account {0}. Available: {1}, Required: {2}").format(
					frappe.bold(account_doc.name),
					flt(account_doc.current_balance),
					flt(self.amount),
				)
			)

	def _apply_balance_update(self, account_doc):
		account_doc.current_balance = flt(self.balance_after)
		account_doc.save(ignore_permissions=True)

		if self.entry_type == "Account to Account":
			dest_doc = frappe.get_doc("Petty Cash Account", self.to_petty_cash_account)
			dest_doc.current_balance = flt(dest_doc.current_balance) + flt(self.amount)
			dest_doc.save(ignore_permissions=True)


@frappe.whitelist()
def get_live_balance_preview(petty_cash_account, entry_type, amount=0, to_petty_cash_account=None):
	"""Return real-time balance preview for draft form updates."""
	if not petty_cash_account:
		return {
			"balance_before": 0,
			"balance_after": 0,
			"can_submit": 0,
			"message": _("Select Petty Cash Account to preview balance."),
		}

	account = frappe.get_doc("Petty Cash Account", petty_cash_account)
	current_balance = flt(account.current_balance)
	amount = flt(amount)

	if amount < 0:
		amount = 0

	if entry_type == "Topup":
		projected_balance = current_balance + amount
	else:
		# Debit and Account to Account both reduce the source.
		projected_balance = current_balance - amount

	can_submit = 1
	message = ""
	if entry_type in ("Debit", "Account to Account") and not account.allow_negative_balance and projected_balance < 0:
		can_submit = 0
		message = _(
			"Insufficient balance. Available: {0}, Required: {1}"
		).format(current_balance, amount)

	result = {
		"balance_before": current_balance,
		"balance_after": projected_balance,
		"can_submit": can_submit,
		"message": message,
	}

	if entry_type == "Account to Account" and to_petty_cash_account:
		dest = frappe.get_doc("Petty Cash Account", to_petty_cash_account)
		result["dest_balance_before"] = flt(dest.current_balance)
		result["dest_balance_after"] = flt(dest.current_balance) + amount

	return result
