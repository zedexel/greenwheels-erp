# Copyright (c) 2026, ZedeXeL and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt


class PettyCashAccount(Document):
	def validate(self):
		self.opening_balance = flt(self.opening_balance)
		self.current_balance = flt(self.current_balance)

		if self.opening_balance < 0:
			frappe.throw(_("Opening Balance cannot be negative."))

		if self.is_new():
			self.current_balance = self.opening_balance
			return

		# Keep current balance in sync if account is untouched by entries.
		# Once entries exist, opening balance should remain locked.
		has_entries = frappe.db.exists("Petty Cash Entry", {"petty_cash_account": self.name})
		if has_entries and self.has_value_changed("opening_balance"):
			frappe.throw(_("Opening Balance cannot be changed after entries exist for this account."))

		if not has_entries and self.has_value_changed("opening_balance"):
			self.current_balance = self.opening_balance
