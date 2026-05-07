frappe.ui.form.on("Petty Cash Entry", {
	refresh(frm) {
		update_balance_preview(frm);
	},

	petty_cash_account(frm) {
		update_balance_preview(frm);
	},

	to_petty_cash_account(frm) {
		update_balance_preview(frm);
	},

	entry_type(frm) {
		if (frm.doc.entry_type === "Topup") {
			frm.set_value("basic_amount", 0);
			frm.set_value("vat_amount", 0);
			frm.set_value("grand_total", 0);
			frm.set_value("to_petty_cash_account", null);
		} else if (frm.doc.entry_type === "Debit") {
			frm.set_value("to_petty_cash_account", null);
			if (!frm.doc.grand_total) {
				frm.set_value("grand_total", frm.doc.amount || 0);
			}
		} else if (frm.doc.entry_type === "Account to Account") {
			frm.set_value("basic_amount", 0);
			frm.set_value("vat_amount", 0);
			frm.set_value("grand_total", 0);
			frm.set_value("account_head", null);
		}
		update_balance_preview(frm);
	},

	amount(frm) {
		if (frm.doc.entry_type === "Debit") {
			frm.set_value("grand_total", frm.doc.amount || 0);
		}
		update_balance_preview(frm);
	},

	basic_amount(frm) {
		if (frm.doc.entry_type === "Debit") {
			frm.set_value("grand_total", (frm.doc.basic_amount || 0) + (frm.doc.vat_amount || 0));
			frm.set_value("amount", frm.doc.grand_total || 0);
		}
	},

	vat_amount(frm) {
		if (frm.doc.entry_type === "Debit") {
			frm.set_value("grand_total", (frm.doc.basic_amount || 0) + (frm.doc.vat_amount || 0));
			frm.set_value("amount", frm.doc.grand_total || 0);
		}
	},
});

function update_balance_preview(frm) {
	if (!frm.doc.petty_cash_account || !frm.doc.entry_type) {
		frm.set_value("balance_before", 0);
		frm.set_value("balance_after", 0);
		frm.dashboard.clear_headline();
		return;
	}

	frappe.call({
		method: "greenwheels.greenwheels.doctype.petty_cash_entry.petty_cash_entry.get_live_balance_preview",
		args: {
			petty_cash_account: frm.doc.petty_cash_account,
			entry_type: frm.doc.entry_type,
			amount: frm.doc.amount || 0,
			to_petty_cash_account: frm.doc.to_petty_cash_account || null,
		},
		callback: function (r) {
			if (!r.message) return;

			frm.set_value("balance_before", r.message.balance_before || 0);
			frm.set_value("balance_after", r.message.balance_after || 0);

			if (r.message.can_submit === 0 && r.message.message) {
				frm.dashboard.set_headline_alert(__(r.message.message), "orange");
			} else if (
				frm.doc.entry_type === "Account to Account" &&
				frm.doc.to_petty_cash_account &&
				r.message.dest_balance_before !== undefined
			) {
				const dest_before = format_currency(r.message.dest_balance_before);
				const dest_after = format_currency(r.message.dest_balance_after);
				frm.dashboard.set_headline_alert(
					__("Destination account {0}: {1} → {2}", [
						frm.doc.to_petty_cash_account,
						dest_before,
						dest_after,
					]),
					"blue"
				);
			} else {
				frm.dashboard.clear_headline();
			}
		},
	});
}

function format_currency(value) {
	return frappe.format(value, { fieldtype: "Currency" });
}
