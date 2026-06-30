import frappe


def has_app_permission():
	if frappe.session.user == "Guest":
		return False
	if "System Manager" in frappe.get_roles(frappe.session.user):
		return True
	return frappe.has_permission("Master Data", "read")
