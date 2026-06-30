import frappe
from frappe import _
from frappe.utils import cint

no_cache = 1
safe_render = False


def get_context(context):
	frappe.db.commit()
	context.boot = get_boot()
	context.safe_render = False
	return context


@frappe.whitelist(methods=["POST"], allow_guest=True)
def get_context_for_dev():
	if not frappe.conf.developer_mode:
		frappe.throw(_("This method is only meant for developer mode"), frappe.PermissionError)
	return get_boot()


def get_boot():
	return frappe._dict(
		{
			"frappe_version": frappe.__version__,
			"default_route": "/greenwheels",
			"site_name": frappe.local.site,
			"csrf_token": frappe.sessions.get_csrf_token(),
			"setup_complete": cint(frappe.get_system_settings("setup_complete")),
			"sysdefaults": frappe.defaults.get_defaults(),
		}
	)
