# Copyright (c) 2026, ZedeXeL and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase


class TestPettyCashEntry(FrappeTestCase):
	def setUp(self):
		self.account = frappe.get_doc(
			{
				"doctype": "Petty Cash Account",
				"account_name": f"Test Petty Account {frappe.generate_hash(length=8)}",
				"opening_balance": 1000,
				"is_active": 1,
			}
		).insert(ignore_permissions=True)

		self.account_head = frappe.get_doc(
			{
				"doctype": "Petty Cash Account Head",
				"account_head_name": f"Fuel Expense {frappe.generate_hash(length=6)}",
				"is_active": 1,
			}
		).insert(ignore_permissions=True)

	def _make_entry(self, entry_type, amount, **kwargs):
		doc = frappe.get_doc(
			{
				"doctype": "Petty Cash Entry",
				"posting_date": frappe.utils.nowdate(),
				"petty_cash_account": self.account.name,
				"entry_type": entry_type,
				"amount": amount,
				**kwargs,
			}
		)
		doc.insert(ignore_permissions=True)
		return doc

	def test_topup_submit_and_cancel(self):
		entry = self._make_entry("Topup", 250)
		entry.submit()

		account = frappe.get_doc("Petty Cash Account", self.account.name)
		self.assertEqual(account.current_balance, 1250)

		entry.cancel()
		account.reload()
		self.assertEqual(account.current_balance, 1000)

	def test_debit_submit_and_cancel(self):
		entry = self._make_entry(
			"Debit",
			200,
			account_head=self.account_head.name,
			basic_amount=180,
			vat_amount=20,
			grand_total=200,
		)
		entry.submit()

		account = frappe.get_doc("Petty Cash Account", self.account.name)
		self.assertEqual(account.current_balance, 800)

		entry.cancel()
		account.reload()
		self.assertEqual(account.current_balance, 1000)

	def test_debit_blocks_when_insufficient_balance(self):
		self.assertRaises(
			frappe.ValidationError,
			self._make_entry,
			"Debit",
			2000,
			account_head=self.account_head.name,
			basic_amount=1800,
			vat_amount=200,
			grand_total=2000,
		)
