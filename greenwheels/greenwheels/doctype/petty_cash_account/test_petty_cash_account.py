# Copyright (c) 2026, ZedeXeL and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase


class TestPettyCashAccount(FrappeTestCase):
	def test_current_balance_is_initialized_from_opening_balance(self):
		account = frappe.get_doc(
			{
				"doctype": "Petty Cash Account",
				"account_name": f"Test Petty Account {frappe.generate_hash(length=8)}",
				"opening_balance": 500,
				"is_active": 1,
			}
		).insert(ignore_permissions=True)

		self.assertEqual(account.current_balance, 500)
