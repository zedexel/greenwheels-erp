// Copyright (c) 2026, ZedeXeL and contributors
// For license information, please see license.txt

frappe.ui.form.on("Master Data", {
	setup: function (frm) {
		// Set disable_rounded_total to prevent rounding (if field exists)
		if (frm.is_new() && frappe.meta.has_field(frm.doctype, "disable_rounded_total")) {
			frm.set_value("disable_rounded_total", 1);
		}

		// Setup queries for item_code fields
		frm.set_query("item_code", "taxi_items", function () {
			return {
				query: "erpnext.controllers.queries.item_query",
				filters: { is_purchase_item: 1 },
			};
		});

		frm.set_query("item_code", "crusher_items", function () {
			return {
				query: "erpnext.controllers.queries.item_query",
				filters: { is_purchase_item: 1 },
			};
		});

		frm.set_query("item_code", "items", function () {
			return {
				query: "erpnext.controllers.queries.item_query",
				filters: { is_sales_item: 1 },
			};
		});
	},

	company: function (frm) {
		// Company currency will be used when creating child documents
		// No need to set currency on Master Data itself
	},

	refresh: function (frm) {
		// Ensure disable_rounded_total is set (if field exists)
		if (frappe.meta.has_field(frm.doctype, "disable_rounded_total") && !frm.doc.disable_rounded_total) {
			frm.set_value("disable_rounded_total", 1);
		}
	},
});

// Purchase Order Item handlers for taxi_items
frappe.ui.form.on("Purchase Order Item", {
	item_code: function (frm, cdt, cdn) {
		const row = locals[cdt][cdn];
		const parentfield = row.parentfield;

		// Only handle if it's from our Master Data form
		if (frm.doctype !== "Master Data" || !row.item_code) return;

		// Validate company and supplier are set
		if (!frm.doc.company) {
			frappe.msgprint(__("Please select Company first"));
			frappe.model.set_value(cdt, cdn, "item_code", "");
			return;
		}

		const supplier =
			parentfield === "taxi_items" ? frm.doc.taxi : parentfield === "crusher_items" ? frm.doc.crusher : null;

		if (!supplier) {
			frappe.msgprint(__("Please select Supplier first"));
			frappe.model.set_value(cdt, cdn, "item_code", "");
			return;
		}

		// Fetch item details
		frm.call({
			method: "erpnext.stock.get_item_details.get_item_details",
			child: row,
			args: {
				doc: {
					doctype: "Purchase Order",
					company: frm.doc.company,
					supplier: supplier,
					transaction_date: parentfield === "taxi_items" ? frm.doc.taxi_date : frm.doc.crusher_date,
					currency: erpnext.get_currency(frm.doc.company),
					conversion_rate: 1.0,
					buying_price_list: null,
					ignore_pricing_rule: 1,
				},
				args: {
					item_code: row.item_code,
					company: frm.doc.company,
					supplier: supplier,
					transaction_date: parentfield === "taxi_items" ? frm.doc.taxi_date : frm.doc.crusher_date,
					currency: erpnext.get_currency(frm.doc.company),
					conversion_rate: 1.0,
					buying_price_list: null,
					price_list_currency: erpnext.get_currency(frm.doc.company),
					plc_conversion_rate: 1.0,
					ignore_pricing_rule: 1,
					doctype: "Purchase Order",
					qty: row.qty || 1,
					uom: row.uom,
					conversion_factor: row.conversion_factor,
				},
			},
			callback: function (r) {
				if (r.message && !r.exc) {
					const item_details = r.message;
					const updated_row = locals[cdt][cdn];

					// Always set item_name (mandatory field)
					if (item_details.item_name) {
						updated_row.item_name = item_details.item_name;
					} else if (updated_row.item_code) {
						// Fallback: use item_code as item_name if not provided
						updated_row.item_name = updated_row.item_code;
					}

					// Set conversion_factor
					if (item_details.conversion_factor) {
						updated_row.conversion_factor = item_details.conversion_factor;
					} else if (!updated_row.conversion_factor) {
						updated_row.conversion_factor = 1.0;
					}

					// Set UOM
					if (item_details.uom && !updated_row.uom) {
						updated_row.uom = item_details.uom;
					}

					if (item_details.stock_uom && !updated_row.stock_uom) {
						updated_row.stock_uom = item_details.stock_uom;
					}

					// Set rate - preserve user-entered rate, otherwise use price_list_rate or 0
					if (!updated_row.rate || updated_row.rate === 0) {
						updated_row.rate = item_details.price_list_rate || item_details.rate || 0;
					}

					// Set base_rate (same as rate for company currency)
					updated_row.base_rate = updated_row.rate;

					// Calculate amount
					const qty = flt(updated_row.qty) || 1;
					const rate = flt(updated_row.rate) || 0;
					updated_row.amount = qty * rate;
					updated_row.base_amount = updated_row.amount;

					// Refresh the field to update UI
					refresh_field(parentfield);
				}
			},
		});
	},

	qty: function (frm, cdt, cdn) {
		const row = locals[cdt][cdn];
		const parentfield = row.parentfield;
		
		// Only handle if it's from our Master Data form
		if (frm.doctype !== "Master Data") return;

		const qty = flt(row.qty) || 0;
		const rate = flt(row.rate) || 0;
		row.amount = qty * rate;
		row.base_amount = row.amount;
		row.base_rate = rate;
		
		refresh_field(parentfield);
	},

	rate: function (frm, cdt, cdn) {
		const row = locals[cdt][cdn];
		const parentfield = row.parentfield;
		
		// Only handle if it's from our Master Data form
		if (frm.doctype !== "Master Data") return;

		const qty = flt(row.qty) || 0;
		const rate = flt(row.rate) || 0;
		row.amount = qty * rate;
		row.base_amount = row.amount;
		row.base_rate = rate;
		
		refresh_field(parentfield);
	},
});

// Delivery Note Item handlers
frappe.ui.form.on("Delivery Note Item", {
	item_code: function (frm, cdt, cdn) {
		const row = locals[cdt][cdn];

		// Only handle if it's from our Master Data form
		if (frm.doctype !== "Master Data" || !row.item_code) return;

		// Validate company and customer are set
		if (!frm.doc.company) {
			frappe.msgprint(__("Please select Company first"));
			frappe.model.set_value(cdt, cdn, "item_code", "");
			return;
		}

		if (!frm.doc.customer) {
			frappe.msgprint(__("Please select Customer first"));
			frappe.model.set_value(cdt, cdn, "item_code", "");
			return;
		}

		// Fetch item details
		frm.call({
			method: "erpnext.stock.get_item_details.get_item_details",
			child: row,
			args: {
				doc: {
					doctype: "Delivery Note",
					company: frm.doc.company,
					customer: frm.doc.customer,
					posting_date: frm.doc.date,
					currency: erpnext.get_currency(frm.doc.company),
					conversion_rate: 1.0,
					selling_price_list: null,
					ignore_pricing_rule: 1,
				},
				args: {
					item_code: row.item_code,
					company: frm.doc.company,
					customer: frm.doc.customer,
					transaction_date: frm.doc.date,
					currency: erpnext.get_currency(frm.doc.company),
					conversion_rate: 1.0,
					selling_price_list: null,
					price_list_currency: erpnext.get_currency(frm.doc.company),
					plc_conversion_rate: 1.0,
					ignore_pricing_rule: 1,
					doctype: "Delivery Note",
					qty: row.qty || 1,
					uom: row.uom,
					conversion_factor: row.conversion_factor,
				},
			},
			callback: function (r) {
				if (r.message && !r.exc) {
					const item_details = r.message;
					const updated_row = locals[cdt][cdn];

					// Always set item_name (mandatory field)
					if (item_details.item_name) {
						updated_row.item_name = item_details.item_name;
					} else if (updated_row.item_code) {
						// Fallback: use item_code as item_name if not provided
						updated_row.item_name = updated_row.item_code;
					}

					// Set conversion_factor
					if (item_details.conversion_factor) {
						updated_row.conversion_factor = item_details.conversion_factor;
					} else if (!updated_row.conversion_factor) {
						updated_row.conversion_factor = 1.0;
					}

					// Set UOM
					if (item_details.uom && !updated_row.uom) {
						updated_row.uom = item_details.uom;
					}

					if (item_details.stock_uom && !updated_row.stock_uom) {
						updated_row.stock_uom = item_details.stock_uom;
					}

					// Set rate - preserve user-entered rate, otherwise use price_list_rate or 0
					if (!updated_row.rate || updated_row.rate === 0) {
						updated_row.rate = item_details.price_list_rate || item_details.rate || 0;
					}

					// Set base_rate (same as rate for company currency)
					updated_row.base_rate = updated_row.rate;

					// Calculate amount
					const qty = flt(updated_row.qty) || 1;
					const rate = flt(updated_row.rate) || 0;
					updated_row.amount = qty * rate;
					updated_row.base_amount = updated_row.amount;

					// Refresh the field to update UI
					refresh_field("items");
				}
			},
		});
	},

	qty: function (frm, cdt, cdn) {
		const row = locals[cdt][cdn];
		
		// Only handle if it's from our Master Data form
		if (frm.doctype !== "Master Data") return;

		const qty = flt(row.qty) || 0;
		const rate = flt(row.rate) || 0;
		row.amount = qty * rate;
		row.base_amount = row.amount;
		row.base_rate = rate;
		
		refresh_field("items");
	},

	rate: function (frm, cdt, cdn) {
		const row = locals[cdt][cdn];
		
		// Only handle if it's from our Master Data form
		if (frm.doctype !== "Master Data") return;

		const qty = flt(row.qty) || 0;
		const rate = flt(row.rate) || 0;
		row.amount = qty * rate;
		row.base_amount = row.amount;
		row.base_rate = rate;
		
		refresh_field("items");
	},
});
