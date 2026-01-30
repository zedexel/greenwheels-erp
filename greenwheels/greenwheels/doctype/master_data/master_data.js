// Copyright (c) 2026, ZedeXeL and contributors
// For license information, please see license.txt

frappe.provide("greenwheels.master_data");

// Tax calculation controller for Master Data
greenwheels.master_data.MasterDataController = class MasterDataController extends erpnext.taxes_and_totals {
	constructor(frm) {
		// Ensure frm is passed as an object if it's not already
		const opts = typeof frm === 'object' && frm.frm ? frm : { frm: frm };
		super(opts);
		// Ensure this.frm is set
		if (!this.frm && opts.frm) {
			this.frm = opts.frm;
		}
		// Bind methods to preserve 'this' context
		this.calculate_taxi_po_totals = this.calculate_taxi_po_totals.bind(this);
		this.calculate_crusher_po_totals = this.calculate_crusher_po_totals.bind(this);
		this.calculate_delivery_note_totals = this.calculate_delivery_note_totals.bind(this);
	}

	setup() {
		// Only call super.setup if frm is available and fields_dict exists
		if (this.frm && this.frm.fields_dict && super.setup) {
			try {
				super.setup();
			} catch(e) {
				console.warn("[MasterData] Error in super.setup():", e);
			}
		}
	}

	onload() {
		// Override onload to prevent errors if parent class tries to access fields_dict
		// Master Data doesn't need the standard onload behavior from StockController
		if (this.frm && this.frm.fields_dict) {
			try {
				// Only call parent onload if it exists and won't cause errors
				if (super.onload && typeof super.onload === 'function') {
					super.onload();
				}
			} catch(e) {
				console.warn("[MasterData] Error in super.onload():", e);
			}
		}
	}

	round_off_totals(tax) {
		// Ensure round_off_applicable_accounts is initialized before calling parent method
		if (!frappe.flags.round_off_applicable_accounts) {
			frappe.flags.round_off_applicable_accounts = [];
		}
		if (super.round_off_totals) {
			super.round_off_totals(tax);
		}
	}

	round_off_base_values(tax) {
		// Ensure round_off_applicable_accounts is initialized before calling parent method
		if (!frappe.flags.round_off_applicable_accounts) {
			frappe.flags.round_off_applicable_accounts = [];
		}
		if (super.round_off_base_values) {
			super.round_off_base_values(tax);
		}
	}

	// Calculate totals for Taxi PO section
	calculate_taxi_po_totals() {
		if (!this || !this.frm) {
			console.error("[MasterData] calculate_taxi_po_totals: this or this.frm is undefined");
			return;
		}
		const frm = this.frm;
		console.log("[MasterData] calculate_taxi_po_totals called");
		
		// Ensure round_off_applicable_accounts is initialized
		if (!frappe.flags.round_off_applicable_accounts) {
			frappe.flags.round_off_applicable_accounts = [];
		}
		
		if (!frm.doc.taxi_items || frm.doc.taxi_items.length === 0) {
			console.log("[MasterData] No taxi_items, setting grand_total to 0");
			frm.doc.taxi_grand_total = 0;
			return;
		}

		console.log("[MasterData] Taxi items prepared:", frm.doc.taxi_items.length, "items");
		console.log("[MasterData] Taxi taxes:", frm.doc.taxi_taxes ? frm.doc.taxi_taxes.length : 0, "taxes");

		// Store original values
		const original_items = frm.doc.items;
		const original_taxes = frm.doc.taxes;
		const original_grand_total = frm.doc.grand_total;
		const original_net_total = frm.doc.net_total;

		// Temporarily set items and taxes for calculation
		frm.doc.items = frm.doc.taxi_items;
		frm.doc.taxes = frm.doc.taxi_taxes || [];
		frm._items = frm.doc.taxi_items;

		// Ensure conversion_rate is set (required for calculations)
		if (!frm.doc.conversion_rate) {
			frm.doc.conversion_rate = 1.0;
		}

		// Calculate item values first (this calculates amount, net_amount, base_amount, base_net_amount)
		this.calculate_item_values();
		
		// Calculate net total
		this.calculate_net_total();
		console.log("[MasterData] After calculate_net_total - net_total:", frm.doc.net_total);

		// Initialize taxes (this sets up item_wise_tax_detail and resets tax fields)
		if (frm.doc.taxes && frm.doc.taxes.length > 0) {
			this.initialize_taxes();
		}

		// Calculate taxes
		if (frm.doc.taxes && frm.doc.taxes.length > 0) {
			console.log("[MasterData] Calling calculate_taxes with", frm.doc.taxes.length, "taxes");
			this.calculate_taxes();
			console.log("[MasterData] After calculate_taxes:");
			$.each(frm.doc.taxes || [], function(i, tax) {
				console.log("[MasterData] Tax", i, "- tax_amount:", tax.tax_amount, "total:", tax.total);
			});
			this.adjust_grand_total_for_inclusive_tax();
		} else {
			console.log("[MasterData] No taxes to calculate");
		}

		// Calculate totals
		this.calculate_totals();
		console.log("[MasterData] After calculate_totals - grand_total:", frm.doc.grand_total);

		// Update taxi_grand_total
		frm.doc.taxi_grand_total = frm.doc.grand_total || frm.doc.net_total || 0;
		console.log("[MasterData] Final taxi_grand_total:", frm.doc.taxi_grand_total);

		// Copy calculated tax values back to taxi_taxes
		if (frm.doc.taxi_taxes && frm.doc.taxes) {
			$.each(frm.doc.taxes || [], function(i, tax) {
				if (frm.doc.taxi_taxes[i]) {
					frm.doc.taxi_taxes[i].tax_amount = tax.tax_amount;
					frm.doc.taxi_taxes[i].tax_amount_after_discount_amount = tax.tax_amount_after_discount_amount;
					frm.doc.taxi_taxes[i].total = tax.total;
					frm.doc.taxi_taxes[i].base_tax_amount = tax.base_tax_amount;
					frm.doc.taxi_taxes[i].base_tax_amount_after_discount_amount = tax.base_tax_amount_after_discount_amount;
					frm.doc.taxi_taxes[i].base_total = tax.base_total;
					console.log("[MasterData] Copied tax", i, "values - tax_amount:", tax.tax_amount, "total:", tax.total);
				}
			});
		}

		// Restore original values
		frm.doc.items = original_items;
		frm.doc.taxes = original_taxes;
		frm.doc.grand_total = original_grand_total;
		frm.doc.net_total = original_net_total;
		frm._items = original_items;

		// Refresh fields - refresh tax table to show calculated values
		console.log("[MasterData] Refreshing fields");
		frm.refresh_field("taxi_taxes");
		frm.refresh_field("taxi_grand_total");
	}

	// Calculate totals for Crusher PO section
	calculate_crusher_po_totals() {
		if (!this || !this.frm) {
			console.error("[MasterData] calculate_crusher_po_totals: this or this.frm is undefined");
			return;
		}
		const frm = this.frm;
		console.log("[MasterData] calculate_crusher_po_totals called");
		
		// Ensure round_off_applicable_accounts is initialized
		if (!frappe.flags.round_off_applicable_accounts) {
			frappe.flags.round_off_applicable_accounts = [];
		}
		
		if (!frm.doc.crusher_items || frm.doc.crusher_items.length === 0) {
			console.log("[MasterData] No crusher_items, setting grand_total to 0");
			frm.doc.crusher_grand_total = 0;
			return;
		}

		console.log("[MasterData] Crusher items prepared:", frm.doc.crusher_items.length, "items");
		console.log("[MasterData] Crusher taxes:", frm.doc.crusher_taxes ? frm.doc.crusher_taxes.length : 0, "taxes");

		// Store original values
		const original_items = frm.doc.items;
		const original_taxes = frm.doc.taxes;
		const original_grand_total = frm.doc.grand_total;
		const original_net_total = frm.doc.net_total;

		// Temporarily set items and taxes for calculation
		frm.doc.items = frm.doc.crusher_items;
		frm.doc.taxes = frm.doc.crusher_taxes || [];
		frm._items = frm.doc.crusher_items;

		// Ensure conversion_rate is set (required for calculations)
		if (!frm.doc.conversion_rate) {
			frm.doc.conversion_rate = 1.0;
		}

		// Calculate item values first (this calculates amount, net_amount, base_amount, base_net_amount)
		this.calculate_item_values();
		
		// Calculate net total
		this.calculate_net_total();
		console.log("[MasterData] After calculate_net_total - net_total:", frm.doc.net_total);

		// Initialize taxes (this sets up item_wise_tax_detail and resets tax fields)
		if (frm.doc.taxes && frm.doc.taxes.length > 0) {
			this.initialize_taxes();
		}

		// Calculate taxes
		if (frm.doc.taxes && frm.doc.taxes.length > 0) {
			console.log("[MasterData] Calling calculate_taxes with", frm.doc.taxes.length, "taxes");
			this.calculate_taxes();
			console.log("[MasterData] After calculate_taxes:");
			$.each(frm.doc.taxes || [], function(i, tax) {
				console.log("[MasterData] Tax", i, "- tax_amount:", tax.tax_amount, "total:", tax.total);
			});
			this.adjust_grand_total_for_inclusive_tax();
		} else {
			console.log("[MasterData] No taxes to calculate");
		}

		// Calculate totals
		this.calculate_totals();
		console.log("[MasterData] After calculate_totals - grand_total:", frm.doc.grand_total);

		// Update crusher_grand_total
		frm.doc.crusher_grand_total = frm.doc.grand_total || frm.doc.net_total || 0;
		console.log("[MasterData] Final crusher_grand_total:", frm.doc.crusher_grand_total);

		// Copy calculated tax values back to crusher_taxes
		if (frm.doc.crusher_taxes && frm.doc.taxes) {
			$.each(frm.doc.taxes || [], function(i, tax) {
				if (frm.doc.crusher_taxes[i]) {
					frm.doc.crusher_taxes[i].tax_amount = tax.tax_amount;
					frm.doc.crusher_taxes[i].tax_amount_after_discount_amount = tax.tax_amount_after_discount_amount;
					frm.doc.crusher_taxes[i].total = tax.total;
					frm.doc.crusher_taxes[i].base_tax_amount = tax.base_tax_amount;
					frm.doc.crusher_taxes[i].base_tax_amount_after_discount_amount = tax.base_tax_amount_after_discount_amount;
					frm.doc.crusher_taxes[i].base_total = tax.base_total;
					console.log("[MasterData] Copied tax", i, "values - tax_amount:", tax.tax_amount, "total:", tax.total);
				}
			});
		}

		// Restore original values
		frm.doc.items = original_items;
		frm.doc.taxes = original_taxes;
		frm.doc.grand_total = original_grand_total;
		frm.doc.net_total = original_net_total;
		frm._items = original_items;

		// Refresh fields - refresh tax table to show calculated values
		console.log("[MasterData] Refreshing fields");
		frm.refresh_field("crusher_taxes");
		frm.refresh_field("crusher_grand_total");
	}

	// Calculate totals for Delivery Note section
	calculate_delivery_note_totals() {
		if (!this || !this.frm) {
			console.error("[MasterData] calculate_delivery_note_totals: this or this.frm is undefined");
			return;
		}
		const frm = this.frm;
		console.log("[MasterData] calculate_delivery_note_totals called");
		
		// Ensure round_off_applicable_accounts is initialized
		if (!frappe.flags.round_off_applicable_accounts) {
			frappe.flags.round_off_applicable_accounts = [];
		}
		
		if (!frm.doc.items || frm.doc.items.length === 0) {
			console.log("[MasterData] No items, setting grand_total to 0");
			frm.doc.do_grand_total = 0;
			return;
		}

		console.log("[MasterData] Delivery Note items prepared:", frm.doc.items.length, "items");
		console.log("[MasterData] Delivery Note taxes:", frm.doc.taxes ? frm.doc.taxes.length : 0, "taxes");

		// Store original values
		const original_taxes = frm.doc.taxes;
		const original_grand_total = frm.doc.grand_total;
		const original_net_total = frm.doc.net_total;

		// Set taxes for calculation
		frm.doc.taxes = frm.doc.taxes || [];
		frm._items = frm.doc.items;

		// Ensure conversion_rate is set (required for calculations)
		if (!frm.doc.conversion_rate) {
			frm.doc.conversion_rate = 1.0;
		}

		// Calculate item values first (this calculates amount, net_amount, base_amount, base_net_amount)
		this.calculate_item_values();
		
		// Calculate net total
		this.calculate_net_total();
		console.log("[MasterData] After calculate_net_total - net_total:", frm.doc.net_total);

		// Initialize taxes (this sets up item_wise_tax_detail and resets tax fields)
		if (frm.doc.taxes && frm.doc.taxes.length > 0) {
			this.initialize_taxes();
		}

		// Calculate taxes
		if (frm.doc.taxes && frm.doc.taxes.length > 0) {
			console.log("[MasterData] Calling calculate_taxes with", frm.doc.taxes.length, "taxes");
			this.calculate_taxes();
			console.log("[MasterData] After calculate_taxes:");
			$.each(frm.doc.taxes || [], function(i, tax) {
				console.log("[MasterData] Tax", i, "- tax_amount:", tax.tax_amount, "total:", tax.total);
			});
			this.adjust_grand_total_for_inclusive_tax();
		} else {
			console.log("[MasterData] No taxes to calculate");
		}

		// Calculate totals
		this.calculate_totals();
		console.log("[MasterData] After calculate_totals - grand_total:", frm.doc.grand_total);

		// Update do_grand_total
		frm.doc.do_grand_total = frm.doc.grand_total || frm.doc.net_total || 0;
		console.log("[MasterData] Final do_grand_total:", frm.doc.do_grand_total);

		// Restore original values
		frm.doc.taxes = original_taxes;
		frm.doc.grand_total = original_grand_total;
		frm.doc.net_total = original_net_total;

		// Refresh fields - refresh tax table to show calculated values
		console.log("[MasterData] Refreshing fields");
		frm.refresh_field("taxes");
		frm.refresh_field("do_grand_total");
	}
};

frappe.ui.form.on("Master Data", {
	setup: function (frm) {
		// Trigger calculations when tax rows are added or removed
		frm.setup_event_listeners = function() {
			// Listen for changes in tax tables
			["taxi_taxes", "crusher_taxes", "taxes"].forEach(function(fieldname) {
				frm.fields_dict[fieldname]?.grid?.watch(function() {
					if (frm.doctype === "Master Data") {
						if (fieldname === "taxi_taxes") {
							frm.cscript.calculate_taxi_po_totals();
						} else if (fieldname === "crusher_taxes") {
							frm.cscript.calculate_crusher_po_totals();
						} else if (fieldname === "taxes") {
							frm.cscript.calculate_delivery_note_totals();
						}
					}
				});
			});
		};
		// Set disable_rounded_total to prevent rounding (if field exists)
		if (frm.is_new() && frappe.meta.has_field(frm.doctype, "disable_rounded_total")) {
			frm.set_value("disable_rounded_total", 1);
		}

		// Setup tax calculation controller
		frm.cscript = new greenwheels.master_data.MasterDataController(frm);

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

		// Handle amendments - create amended versions of linked documents if they're cancelled
		if (frm.doc.amended_from && frm.doc.docstatus === 0) {
			frm.events.handle_amendment_linked_documents(frm);
		}

		// Hide the dashboard's built-in Connections section (we'll create a custom one)
		if (frm.dashboard && frm.dashboard.links_area) {
			frm.dashboard.links_area.hide();
		}

		// Add Connections section with links to Purchase Orders and Delivery Note
		if (!frm.is_new()) {
			// Wait for dashboard to be initialized if not ready yet
			if (frm.dashboard && frm.dashboard.transactions_area) {
				frm.events.render_connections(frm);
			} else {
				// Retry after a short delay if dashboard is not ready
				setTimeout(function() {
					if (frm.dashboard && frm.dashboard.transactions_area) {
						frm.events.render_connections(frm);
					}
					// Also hide the dashboard Connections section in the retry
					if (frm.dashboard && frm.dashboard.links_area) {
						frm.dashboard.links_area.hide();
					}
				}, 100);
			}
		}

		// Add "Get Items From Sales Order" button in Delivery Note tab
		if (
			frm.doc.docstatus === 0 &&
			frm.has_perm("write") &&
			frappe.model.can_read("Sales Order")
		) {
			frm.add_custom_button(
				__("Sales Order"),
				function () {
					if (!frm.doc.customer) {
						frappe.throw({
							title: __("Mandatory"),
							message: __("Please Select a Customer"),
						});
					}
					if (!frm.doc.project) {
						frappe.throw({
							title: __("Mandatory"),
							message: __("Please Select a Project"),
						});
					}
					erpnext.utils.map_current_doc({
						method: "greenwheels.greenwheels.doctype.master_data.master_data.make_delivery_note_from_sales_order",
						source_doctype: "Sales Order",
						target: frm,
						setters: {
							customer: frm.doc.customer,
						},
						get_query_filters: {
							docstatus: 1,
							status: ["not in", ["Closed", "On Hold"]],
							per_delivered: ["<", 99.99],
							company: frm.doc.company,
							project: frm.doc.project || undefined,
						},
						allow_child_item_selection: true,
						child_fieldname: "items",
						child_columns: ["item_code", "item_name", "qty", "delivered_qty"],
					});
				},
				__("Get Items From")
			);
		}
	},

	handle_amendment_linked_documents: function (frm) {
		/**Handle amendments - create amended versions of linked documents if they're cancelled*/
		const linked_docs = [];
		
		// Collect all linked documents that need to be checked
		if (frm.doc.taxi_po_name) {
			linked_docs.push({
				field_name: "taxi_po_name",
				doc_name: frm.doc.taxi_po_name,
				doctype: "Purchase Order"
			});
		}
		
		if (frm.doc.crusher_po_name && !frm.doc.crusher_included) {
			linked_docs.push({
				field_name: "crusher_po_name",
				doc_name: frm.doc.crusher_po_name,
				doctype: "Purchase Order"
			});
		}
		
		if (frm.doc.delivery_note_name) {
			linked_docs.push({
				field_name: "delivery_note_name",
				doc_name: frm.doc.delivery_note_name,
				doctype: "Delivery Note"
			});
		}
		
		if (linked_docs.length === 0) {
			return;
		}
		
		// Process linked documents sequentially to avoid race conditions
		let processed_count = 0;
		
		linked_docs.forEach(function(linked_doc) {
			// Check if document exists and is cancelled
			frappe.db.get_value(linked_doc.doctype, linked_doc.doc_name, ["docstatus", "name"], function(r) {
				processed_count++;
				
				if (r && r.docstatus === 2) {
					// Document is cancelled, check if amended version already exists
					frappe.db.get_value(linked_doc.doctype, {"amended_from": linked_doc.doc_name}, "name", function(amended_r) {
						if (amended_r && amended_r.name) {
							// Amended version already exists, update the link
							frm.set_value(linked_doc.field_name, amended_r.name);
						} else {
							// Create amended version using custom method
							frappe.call({
								method: "greenwheels.greenwheels.doctype.master_data.master_data.create_amended_linked_document",
								args: {
									doctype: linked_doc.doctype,
									source_name: linked_doc.doc_name
								},
								callback: function(copy_r) {
									if (copy_r && copy_r.message && copy_r.message.name) {
										// Update the link to point to the new amended document
										frm.set_value(linked_doc.field_name, copy_r.message.name);
										const message = copy_r.message.already_exists 
											? __("{0} amended version already exists: {1}", [linked_doc.doctype, copy_r.message.name])
											: __("{0} amended version created: {1}", [linked_doc.doctype, copy_r.message.name]);
										frappe.show_alert({
											message: message,
											indicator: "green"
										});
									}
								},
								error: function(err) {
									console.error("Error creating amended " + linked_doc.doctype + ":", err);
									frappe.show_alert({
										message: __("Error creating amended {0}: {1}", [linked_doc.doctype, err.message || err]),
										indicator: "red"
									});
								}
							});
						}
					});
				}
				
				// If all documents are processed and none needed amendment, we're done
				if (processed_count === linked_docs.length) {
					// All checks completed
				}
			});
		});
	},

	render_connections: function (frm) {
		// Clear any existing custom connection links
		if (frm.dashboard && frm.dashboard.transactions_area) {
			frm.dashboard.transactions_area.find(".custom-master-data-link").remove();
		}

		// Show Connections section if there are any linked documents
		const has_links = 
			(frm.doc.taxi_po_name) ||
			(frm.doc.crusher_po_name && !frm.doc.crusher_included) ||
			(frm.doc.delivery_note_name);

		if (!has_links) {
			return;
		}

		// Hide the dashboard's built-in Connections section since we're creating a custom one
		if (frm.dashboard && frm.dashboard.links_area) {
			frm.dashboard.links_area.hide();
		}

		// Create a group for Master Data links
		const links_group = $('<div class="row"></div>');
		const links_col = $('<div class="col-md-4"></div>');
		const links_title = $('<div class="form-link-title"><span>' + __("Linked Documents") + '</span></div>');
		links_col.append(links_title);

		// Add Taxi Purchase Order link
		if (frm.doc.taxi_po_name) {
			const taxi_po_link = $('<div class="document-link custom-master-data-link" data-doctype="Purchase Order" data-name="' + frm.doc.taxi_po_name + '"></div>');
			taxi_po_link.html(`
				<div class="document-link-badge" data-doctype="Purchase Order">
					<span class="count hidden"></span>
					<a class="badge-link" href="#" data-doctype="Purchase Order" data-name="${frm.doc.taxi_po_name}">${__("Taxi Purchase Order")}</a>
				</div>
			`);
			links_col.append(taxi_po_link);
		}

		// Add Crusher Purchase Order link (only if crusher_included is false)
		if (frm.doc.crusher_po_name && !frm.doc.crusher_included) {
			const crusher_po_link = $('<div class="document-link custom-master-data-link" data-doctype="Purchase Order" data-name="' + frm.doc.crusher_po_name + '"></div>');
			crusher_po_link.html(`
				<div class="document-link-badge" data-doctype="Purchase Order">
					<span class="count hidden"></span>
					<a class="badge-link" href="#" data-doctype="Purchase Order" data-name="${frm.doc.crusher_po_name}">${__("Crusher Purchase Order")}</a>
				</div>
			`);
			links_col.append(crusher_po_link);
		}

		// Add Delivery Note link
		if (frm.doc.delivery_note_name) {
			const dn_link = $('<div class="document-link custom-master-data-link" data-doctype="Delivery Note" data-name="' + frm.doc.delivery_note_name + '"></div>');
			dn_link.html(`
				<div class="document-link-badge" data-doctype="Delivery Note">
					<span class="count hidden"></span>
					<a class="badge-link" href="#" data-doctype="Delivery Note" data-name="${frm.doc.delivery_note_name}">${__("Delivery Note")}</a>
				</div>
			`);
			links_col.append(dn_link);
		}

		// Only append if we have links
		if (links_col.children(".document-link").length > 0) {
			links_group.append(links_col);
			
			// Create a proper Connections section wrapper with dashboard styling
			const connections_section = $('<div class="row form-dashboard-section form-links card-section" data-fieldname="master_data_connections"></div>');
			const section_head = $('<div class="section-head collapsible"><span>' + __("Connections") + '</span></div>');
			const section_body = $('<div class="section-body"></div>');
			const transactions_container = $('<div class="transactions"></div>');
			
			transactions_container.append(links_group);
			section_body.append(transactions_container);
			connections_section.append(section_head);
			connections_section.append(section_body);
			
			// Function to append Connections section below project_details_section
			const appendLinks = function() {
				// Remove any existing custom connections section (in case of re-render)
				if (frm.layout && frm.layout.wrapper) {
					frm.layout.wrapper.find('[data-fieldname="master_data_connections"]').remove();
				}
				if (frm.dashboard && frm.dashboard.transactions_area) {
					frm.dashboard.transactions_area.find(".custom-master-data-link").closest(".row").remove();
				}
				
				// Find the project_details_section wrapper in the form layout
				let project_details_wrapper = null;
				if (frm.layout && frm.layout.wrapper) {
					project_details_wrapper = frm.layout.wrapper.find('[data-fieldname="project_details_section"]');
				}
				
				// If project_details_section exists, insert Connections section after it
				if (project_details_wrapper && project_details_wrapper.length > 0) {
					// Find the parent section wrapper (form-section) and insert after it
					const project_section = project_details_wrapper.closest('.form-section, .form-dashboard-section');
					if (project_section.length > 0) {
						project_section.after(connections_section);
					} else {
						// Fallback: insert after the field wrapper
						project_details_wrapper.after(connections_section);
					}
					
					// Attach event handlers after insertion using event delegation
					connections_section.off("click", ".badge-link").on("click", ".badge-link", function(e) {
						e.preventDefault();
						const doctype = $(this).attr("data-doctype");
						const docname = $(this).attr("data-name");
						if (doctype && docname) {
							frappe.set_route("Form", doctype, docname);
						}
					});
				} else if (frm.dashboard && frm.dashboard.transactions_area) {
					// Fallback: append to the very bottom of the transactions area
					frm.dashboard.transactions_area.append(links_group);
					// Attach event handlers for fallback case
					links_group.off("click", ".badge-link").on("click", ".badge-link", function(e) {
						e.preventDefault();
						const doctype = $(this).attr("data-doctype");
						const docname = $(this).attr("data-name");
						if (doctype && docname) {
							frappe.set_route("Form", doctype, docname);
						}
					});
				}
			};
			
			// Try immediately first
			appendLinks();
			// Also try after a delay to ensure it's after Frappe's async rendering
			setTimeout(appendLinks, 300);
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

					// Calculate amount and net_amount
					const qty = flt(updated_row.qty) || 1;
					const rate = flt(updated_row.rate) || 0;
					updated_row.amount = qty * rate;
					updated_row.base_amount = updated_row.amount;
					updated_row.base_rate = rate;
					
					// Calculate net_amount (amount - discount)
					const discount_amount = flt(updated_row.discount_amount) || 0;
					updated_row.net_amount = updated_row.amount - discount_amount;
					updated_row.base_net_amount = updated_row.net_amount;

					// Refresh the field to update UI
					refresh_field(parentfield);
					
					// Trigger tax calculation for the appropriate section
					if (parentfield === "taxi_items") {
						frm.cscript.calculate_taxi_po_totals();
					} else if (parentfield === "crusher_items") {
						frm.cscript.calculate_crusher_po_totals();
					}
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
		const discount_amount = flt(row.discount_amount) || 0;
		
		row.amount = qty * rate;
		row.base_amount = row.amount;
		row.base_rate = rate;
		row.net_amount = row.amount - discount_amount;
		row.base_net_amount = row.net_amount;
		
		refresh_field(parentfield);
		
		// Trigger tax calculation for the appropriate section
		if (parentfield === "taxi_items") {
			frm.cscript.calculate_taxi_po_totals();
		} else if (parentfield === "crusher_items") {
			frm.cscript.calculate_crusher_po_totals();
		}
	},

	rate: function (frm, cdt, cdn) {
		const row = locals[cdt][cdn];
		const parentfield = row.parentfield;
		
		// Only handle if it's from our Master Data form
		if (frm.doctype !== "Master Data") return;

		const qty = flt(row.qty) || 0;
		const rate = flt(row.rate) || 0;
		const discount_amount = flt(row.discount_amount) || 0;
		
		row.amount = qty * rate;
		row.base_amount = row.amount;
		row.base_rate = rate;
		row.net_amount = row.amount - discount_amount;
		row.base_net_amount = row.net_amount;
		
		refresh_field(parentfield);
		
		// Trigger tax calculation for the appropriate section
		if (parentfield === "taxi_items") {
			frm.cscript.calculate_taxi_po_totals();
		} else if (parentfield === "crusher_items") {
			frm.cscript.calculate_crusher_po_totals();
		}
	},

	discount_amount: function (frm, cdt, cdn) {
		const row = locals[cdt][cdn];
		const parentfield = row.parentfield;
		
		// Only handle if it's from our Master Data form
		if (frm.doctype !== "Master Data") return;

		const amount = flt(row.amount) || 0;
		const discount_amount = flt(row.discount_amount) || 0;
		
		row.net_amount = amount - discount_amount;
		row.base_net_amount = row.net_amount;
		
		refresh_field(parentfield);
		
		// Trigger tax calculation for the appropriate section
		if (parentfield === "taxi_items") {
			frm.cscript.calculate_taxi_po_totals();
		} else if (parentfield === "crusher_items") {
			frm.cscript.calculate_crusher_po_totals();
		}
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

					// Calculate amount and net_amount
					const qty = flt(updated_row.qty) || 1;
					const rate = flt(updated_row.rate) || 0;
					updated_row.amount = qty * rate;
					updated_row.base_amount = updated_row.amount;
					updated_row.base_rate = rate;
					
					// Calculate net_amount (amount - discount)
					const discount_amount = flt(updated_row.discount_amount) || 0;
					updated_row.net_amount = updated_row.amount - discount_amount;
					updated_row.base_net_amount = updated_row.net_amount;

					// Refresh the field to update UI
					refresh_field("items");
					
					// Trigger tax calculation for Delivery Note section
					frm.cscript.calculate_delivery_note_totals();
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
		const discount_amount = flt(row.discount_amount) || 0;
		
		row.amount = qty * rate;
		row.base_amount = row.amount;
		row.base_rate = rate;
		row.net_amount = row.amount - discount_amount;
		row.base_net_amount = row.net_amount;
		
		refresh_field("items");
		
		// Trigger tax calculation for Delivery Note section
		frm.cscript.calculate_delivery_note_totals();
	},

	rate: function (frm, cdt, cdn) {
		const row = locals[cdt][cdn];
		
		// Only handle if it's from our Master Data form
		if (frm.doctype !== "Master Data") return;

		const qty = flt(row.qty) || 0;
		const rate = flt(row.rate) || 0;
		const discount_amount = flt(row.discount_amount) || 0;
		
		row.amount = qty * rate;
		row.base_amount = row.amount;
		row.base_rate = rate;
		row.net_amount = row.amount - discount_amount;
		row.base_net_amount = row.net_amount;
		
		refresh_field("items");
		
		// Trigger tax calculation for Delivery Note section
		frm.cscript.calculate_delivery_note_totals();
	},

	discount_amount: function (frm, cdt, cdn) {
		const row = locals[cdt][cdn];
		
		// Only handle if it's from our Master Data form
		if (frm.doctype !== "Master Data") return;

		const amount = flt(row.amount) || 0;
		const discount_amount = flt(row.discount_amount) || 0;
		
		row.net_amount = amount - discount_amount;
		row.base_net_amount = row.net_amount;
		
		refresh_field("items");
		
		// Trigger tax calculation for Delivery Note section
		frm.cscript.calculate_delivery_note_totals();
	},
});

// Purchase Taxes and Charges handlers (for taxi_taxes and crusher_taxes)
frappe.ui.form.on("Purchase Taxes and Charges", {
	rate: function (frm, cdt, cdn) {
		if (frm.doctype !== "Master Data") return;
		const row = locals[cdt][cdn];
		const parentfield = row.parentfield;
		
		if (parentfield === "taxi_taxes") {
			if (frm.cscript && frm.cscript.calculate_taxi_po_totals) {
				frm.cscript.calculate_taxi_po_totals();
			}
		} else if (parentfield === "crusher_taxes") {
			if (frm.cscript && frm.cscript.calculate_crusher_po_totals) {
				frm.cscript.calculate_crusher_po_totals();
			}
		}
	},

	tax_amount: function (frm, cdt, cdn) {
		if (frm.doctype !== "Master Data") return;
		const row = locals[cdt][cdn];
		const parentfield = row.parentfield;
		
		if (parentfield === "taxi_taxes") {
			if (frm.cscript && frm.cscript.calculate_taxi_po_totals) {
				frm.cscript.calculate_taxi_po_totals();
			}
		} else if (parentfield === "crusher_taxes") {
			if (frm.cscript && frm.cscript.calculate_crusher_po_totals) {
				frm.cscript.calculate_crusher_po_totals();
			}
		}
	},

	row_id: function (frm, cdt, cdn) {
		if (frm.doctype !== "Master Data") return;
		const row = locals[cdt][cdn];
		const parentfield = row.parentfield;
		
		if (parentfield === "taxi_taxes") {
			frm.cscript.calculate_taxi_po_totals();
		} else if (parentfield === "crusher_taxes") {
			frm.cscript.calculate_crusher_po_totals();
		}
	},

	charge_type: function (frm, cdt, cdn) {
		if (frm.doctype !== "Master Data") return;
		const row = locals[cdt][cdn];
		const parentfield = row.parentfield;
		
		// If account_head is already set, fetch rate and description
		if (row.account_head && row.charge_type) {
			frappe.call({
				type: "GET",
				method: "erpnext.controllers.accounts_controller.get_tax_rate",
				args: {"account_head": row.account_head},
				callback: function(r) {
					if (r.message) {
						let values_set = 0;
						const total_values = row.description ? 1 : 2; // rate and maybe description
						
						const trigger_calculation = function() {
							values_set++;
							if (values_set >= total_values) {
								// Trigger calculation after all values are set
								if (parentfield === "taxi_taxes") {
									frm.cscript.calculate_taxi_po_totals();
								} else if (parentfield === "crusher_taxes") {
									frm.cscript.calculate_crusher_po_totals();
								}
							}
						};
						
						// Set rate if charge_type is not "Actual"
						if (row.charge_type !== "Actual") {
							frappe.model.set_value(cdt, cdn, "rate", r.message.tax_rate || 0, function() {
								trigger_calculation();
							});
						} else {
							values_set++; // Skip rate if Actual
						}
						
						// Set description if not already set
						if (!row.description) {
							frappe.model.set_value(cdt, cdn, "description", r.message.account_name || row.account_head, function() {
								trigger_calculation();
							});
						} else {
							values_set++; // Skip if already set
							trigger_calculation(); // Still trigger calculation
						}
					}
				}
			});
		} else {
			// Just trigger calculation
			if (parentfield === "taxi_taxes") {
				frm.cscript.calculate_taxi_po_totals();
			} else if (parentfield === "crusher_taxes") {
				frm.cscript.calculate_crusher_po_totals();
			}
		}
	},

	included_in_print_rate: function (frm, cdt, cdn) {
		if (frm.doctype !== "Master Data") return;
		const row = locals[cdt][cdn];
		const parentfield = row.parentfield;
		
		if (parentfield === "taxi_taxes") {
			frm.cscript.calculate_taxi_po_totals();
		} else if (parentfield === "crusher_taxes") {
			frm.cscript.calculate_crusher_po_totals();
		}
	},

	category: function (frm, cdt, cdn) {
		if (frm.doctype !== "Master Data") return;
		const row = locals[cdt][cdn];
		const parentfield = row.parentfield;
		
		if (parentfield === "taxi_taxes") {
			frm.cscript.calculate_taxi_po_totals();
		} else if (parentfield === "crusher_taxes") {
			frm.cscript.calculate_crusher_po_totals();
		}
	},

	add_deduct_tax: function (frm, cdt, cdn) {
		if (frm.doctype !== "Master Data") return;
		const row = locals[cdt][cdn];
		const parentfield = row.parentfield;
		
		if (parentfield === "taxi_taxes") {
			frm.cscript.calculate_taxi_po_totals();
		} else if (parentfield === "crusher_taxes") {
			frm.cscript.calculate_crusher_po_totals();
		}
	},

	account_head: function (frm, cdt, cdn) {
		// Check if this is from Master Data form
		if (!frm || frm.doctype !== "Master Data") return;
		
		const row = locals[cdt][cdn];
		if (!row) return;
		
		const parentfield = row.parentfield;
		
		// Only handle taxi_taxes and crusher_taxes
		if (parentfield !== "taxi_taxes" && parentfield !== "crusher_taxes") return;
		
		if (!row.account_head) {
			// Clear rate and description if account_head is cleared
			frappe.model.set_value(cdt, cdn, "rate", 0);
			frappe.model.set_value(cdt, cdn, "description", "");
			if (parentfield === "taxi_taxes") {
				frm.cscript.calculate_taxi_po_totals();
			} else if (parentfield === "crusher_taxes") {
				frm.cscript.calculate_crusher_po_totals();
			}
			return;
		}
		
		// Check if charge_type is set
		if (!row.charge_type) {
			frappe.msgprint(__("Please select Charge Type first"));
			frappe.model.set_value(cdt, cdn, "account_head", "");
			return;
		}
		
		// Fetch tax rate and description from account
		frappe.call({
			type: "GET",
			method: "erpnext.controllers.accounts_controller.get_tax_rate",
			args: {"account_head": row.account_head},
			callback: function(r) {
				if (r.message && r.message !== null) {
					let values_set = 0;
					const total_values = 2; // rate and description
					
					const trigger_calculation = function() {
						values_set++;
						if (values_set >= total_values) {
							// Trigger calculation after all values are set
							if (parentfield === "taxi_taxes") {
								if (frm.cscript && frm.cscript.calculate_taxi_po_totals) {
									frm.cscript.calculate_taxi_po_totals();
								}
							} else if (parentfield === "crusher_taxes") {
								if (frm.cscript && frm.cscript.calculate_crusher_po_totals) {
									frm.cscript.calculate_crusher_po_totals();
								}
							}
						}
					};
					
					// Set rate if charge_type is not "Actual"
					if (row.charge_type !== "Actual") {
						frappe.model.set_value(cdt, cdn, "rate", r.message.tax_rate || 0, function() {
							trigger_calculation();
						});
					} else {
						values_set++; // Skip rate if Actual
					}
					
					// Set description
					frappe.model.set_value(cdt, cdn, "description", r.message.account_name || row.account_head, function() {
						trigger_calculation();
					});
				}
			}
		});
	},
});

// Sales Taxes and Charges handlers (for taxes/Delivery Note)
frappe.ui.form.on("Sales Taxes and Charges", {
	rate: function (frm, cdt, cdn) {
		if (frm.doctype !== "Master Data") return;
		frm.cscript.calculate_delivery_note_totals();
	},

	tax_amount: function (frm, cdt, cdn) {
		if (frm.doctype !== "Master Data") return;
		frm.cscript.calculate_delivery_note_totals();
	},

	row_id: function (frm, cdt, cdn) {
		if (frm.doctype !== "Master Data") return;
		frm.cscript.calculate_delivery_note_totals();
	},

	charge_type: function (frm, cdt, cdn) {
		if (frm.doctype !== "Master Data") return;
		const row = locals[cdt][cdn];
		
		// If account_head is already set, fetch rate and description
		if (row.account_head && row.charge_type) {
			frappe.call({
				type: "GET",
				method: "erpnext.controllers.accounts_controller.get_tax_rate",
				args: {"account_head": row.account_head},
				callback: function(r) {
					if (r.message) {
						// Set rate if charge_type is not "Actual"
						if (row.charge_type !== "Actual") {
							frappe.model.set_value(cdt, cdn, "rate", r.message.tax_rate || 0);
						}
						// Set description
						if (!row.description) {
							frappe.model.set_value(cdt, cdn, "description", r.message.account_name || row.account_head);
						}
						
						// Trigger calculation after values are set
						setTimeout(function() {
							frm.cscript.calculate_delivery_note_totals();
						}, 100);
					}
				}
			});
		} else {
			// Just trigger calculation
			frm.cscript.calculate_delivery_note_totals();
		}
	},

	included_in_print_rate: function (frm, cdt, cdn) {
		if (frm.doctype !== "Master Data") return;
		frm.cscript.calculate_delivery_note_totals();
	},

	account_head: function (frm, cdt, cdn) {
		if (frm.doctype !== "Master Data") return;
		const row = locals[cdt][cdn];
		
		if (!row.account_head) {
			// Clear rate and description if account_head is cleared
			frappe.model.set_value(cdt, cdn, "rate", 0);
			frappe.model.set_value(cdt, cdn, "description", "");
			frm.cscript.calculate_delivery_note_totals();
			return;
		}
		
		// Check if charge_type is set
		if (!row.charge_type) {
			frappe.msgprint(__("Please select Charge Type first"));
			frappe.model.set_value(cdt, cdn, "account_head", "");
			return;
		}
		
		// Fetch tax rate and description from account
		frappe.call({
			type: "GET",
			method: "erpnext.controllers.accounts_controller.get_tax_rate",
			args: {"account_head": row.account_head},
			callback: function(r) {
				if (r.message && r.message !== null) {
					let values_set = 0;
					const total_values = 2; // rate and description
					
					const trigger_calculation = function() {
						values_set++;
						if (values_set >= total_values) {
							// Trigger calculation after all values are set
							frm.cscript.calculate_delivery_note_totals();
						}
					};
					
					// Set rate if charge_type is not "Actual"
					if (row.charge_type !== "Actual") {
						frappe.model.set_value(cdt, cdn, "rate", r.message.tax_rate || 0, function() {
							trigger_calculation();
						});
					} else {
						values_set++; // Skip rate if Actual
					}
					
					// Set description
					frappe.model.set_value(cdt, cdn, "description", r.message.account_name || row.account_head, function() {
						trigger_calculation();
					});
				}
			}
		});
	},
});
