import frappe


@frappe.whitelist(allow_guest=True)
def get_session_user():
	return frappe.session.user
