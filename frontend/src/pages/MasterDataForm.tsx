import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import AttachField from "@/components/AttachField";
import {
	CurrencyDisplay,
	FormField,
	FormSection,
	StatusBadge,
	TextInput,
	ValidationBanner,
} from "@/components/FormSection";
import LineItemsTable from "@/components/LineItemsTable";
import LinkField from "@/components/LinkField";
import TaxesTable from "@/components/TaxesTable";
import { frappeCall } from "@/lib/frappe-api";
import {
	calculateMasterDataTotals,
	DN_ITEM_COLUMNS,
	emptyMasterDataDoc,
	fetchProjectName,
	getCalculableSnapshot,
	hasCalculableMasterDataContent,
	mergeMasterDataTotals,
	PO_ITEM_COLUMNS,
	saveMasterData,
	submitMasterData,
	validateMasterData,
	type MasterDataDoc,
} from "@/lib/master-data";

interface LocationState {
	selectField?: string;
	selectedValue?: string;
}

export default function MasterDataForm() {
	const { name } = useParams();
	const navigate = useNavigate();
	const location = useLocation();
	const isCreate = !name || name === "create";
	const returnPath = location.pathname;

	const [doc, setDoc] = useState<MasterDataDoc>(emptyMasterDataDoc());
	const [loading, setLoading] = useState(!isCreate);
	const [saving, setSaving] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [validationErrors, setValidationErrors] = useState<string[]>([]);
	const [error, setError] = useState<string | null>(null);
	const calcTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const isApplyingTotalsRef = useRef(false);
	const calcRequestIdRef = useRef(0);
	const lastCalcSnapshotRef = useRef("");

	const isReadOnly = (doc.docstatus ?? 0) !== 0;

	const showTaxiPettyCash = useMemo(
		() => (doc.taxi_taxes || []).some((row) => row.custom_is_petty_cash),
		[doc.taxi_taxes],
	);

	const showCrusherPettyCash =
		!doc.crusher_included && doc.custom_payment === "Cash";

	const taxiItemContext = useMemo(
		() => ({
			company: doc.company,
			supplier: doc.taxi,
			transactionDate: doc.taxi_date,
		}),
		[doc.company, doc.taxi, doc.taxi_date],
	);

	const crusherItemContext = useMemo(
		() => ({
			company: doc.company,
			supplier: doc.crusher,
			transactionDate: doc.crusher_date,
		}),
		[doc.company, doc.crusher, doc.crusher_date],
	);

	const deliveryItemContext = useMemo(
		() => ({
			company: doc.company,
			customer: doc.customer,
			postingDate: doc.date,
		}),
		[doc.company, doc.customer, doc.date],
	);

	const setField = useCallback((field: keyof MasterDataDoc, value: unknown) => {
		setDoc((prev) => ({ ...prev, [field]: value }));
	}, []);

	useEffect(() => {
		const state = location.state as LocationState | null;
		if (state?.selectField && state?.selectedValue) {
			setField(state.selectField as keyof MasterDataDoc, state.selectedValue);
			if (state.selectField === "project") {
				fetchProjectName(state.selectedValue).then((projectName) => {
					if (projectName) setField("project_name", projectName);
				});
			}
			navigate(location.pathname, { replace: true, state: null });
		}
	}, [location.pathname, location.state, navigate, setField]);

	useEffect(() => {
		if (isCreate) {
			setDoc(emptyMasterDataDoc());
			setLoading(false);
			return;
		}

		setLoading(true);
		frappeCall<MasterDataDoc>("frappe.client.get", {
			doctype: "Master Data",
			name,
		})
			.then((result) => {
				setDoc({
					...emptyMasterDataDoc(),
					...result,
					taxi_items: result.taxi_items || [],
					crusher_items: result.crusher_items || [],
					items: result.items || [],
					taxi_taxes: result.taxi_taxes || [],
					crusher_taxes: result.crusher_taxes || [],
					taxes: result.taxes || [],
				});
			})
			.catch((err: unknown) => {
				setError(err instanceof Error ? err.message : "Failed to load document");
			})
			.finally(() => setLoading(false));
	}, [isCreate, name]);

	const recalculateTotals = useCallback((currentDoc: MasterDataDoc) => {
		if (!hasCalculableMasterDataContent(currentDoc)) {
			lastCalcSnapshotRef.current = "";
			return;
		}

		const snapshot = getCalculableSnapshot(currentDoc);
		if (snapshot === lastCalcSnapshotRef.current) {
			return;
		}

		if (calcTimerRef.current) clearTimeout(calcTimerRef.current);
		const requestId = ++calcRequestIdRef.current;

		calcTimerRef.current = setTimeout(async () => {
			try {
				const updated = await calculateMasterDataTotals(currentDoc);
				if (requestId !== calcRequestIdRef.current) return;

				lastCalcSnapshotRef.current = snapshot;
				isApplyingTotalsRef.current = true;
				setDoc((prev) => mergeMasterDataTotals(prev, updated));
			} catch {
				// Totals preview is best-effort while editing
			}
		}, 400);
	}, []);

	useEffect(() => {
		if (loading || isReadOnly) return;
		if (isApplyingTotalsRef.current) {
			isApplyingTotalsRef.current = false;
			return;
		}
		recalculateTotals(doc);
		// eslint-disable-next-line react-hooks/exhaustive-deps -- recalc on table/tax changes only
	}, [
		doc.taxi_items,
		doc.crusher_items,
		doc.items,
		doc.taxi_taxes,
		doc.crusher_taxes,
		doc.taxes,
		doc.crusher_included,
		doc.company,
		doc.taxi,
		doc.taxi_date,
		doc.crusher,
		doc.crusher_date,
		doc.customer,
		doc.date,
		loading,
		isReadOnly,
		recalculateTotals,
	]);

	async function handleProjectChange(value: string) {
		setField("project", value);
		if (value) {
			const projectName = await fetchProjectName(value);
			if (projectName) setField("project_name", projectName);
		}
	}

	function handleCrusherIncludedChange(checked: boolean) {
		setDoc((prev) => ({
			...prev,
			crusher_included: checked ? 1 : 0,
			...(checked
				? {
						crusher: undefined,
						crusher_date: undefined,
						crusher_items: [],
						crusher_taxes: [],
					}
				: {}),
		}));
	}

	async function handleSave() {
		const errors = validateMasterData(doc);
		setValidationErrors(errors);
		if (errors.length) return;

		setSaving(true);
		setError(null);
		try {
			const saved = await saveMasterData(doc);
			setDoc((prev) => ({ ...prev, ...saved }));
			if (isCreate && saved.name) {
				navigate(`/master-data/${encodeURIComponent(saved.name)}`, { replace: true });
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Save failed");
		} finally {
			setSaving(false);
		}
	}

	async function handleSubmit() {
		if (!doc.name) {
			setError("Save the document before submitting");
			return;
		}
		if (!window.confirm("Submit this Master Data? Linked POs and Delivery Note will be created.")) {
			return;
		}

		setSubmitting(true);
		setError(null);
		try {
			const submitted = await submitMasterData(doc.name);
			setDoc((prev) => ({ ...prev, ...submitted }));
		} catch (err) {
			setError(err instanceof Error ? err.message : "Submit failed");
		} finally {
			setSubmitting(false);
		}
	}

	if (loading) {
		return (
			<div className="rounded-xl border bg-white p-8 text-sm text-gray-500">
				Loading master data...
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-5xl space-y-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<Link
					to="/master-data"
					className="text-sm font-medium text-emerald-700 hover:underline"
				>
					← Back to listdddd
				</Link>
				<div className="flex flex-wrap items-center gap-2">
					<StatusBadge docstatus={doc.docstatus} />
					{!isReadOnly && (
						<>
							<button
								type="button"
								disabled={saving}
								className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
								onClick={handleSave}
							>
								{saving ? "Saving..." : "Save"}
							</button>
							{doc.name && (
								<button
									type="button"
									disabled={submitting}
									className="rounded-lg border border-emerald-700 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
									onClick={handleSubmit}
								>
									{submitting ? "Submitting..." : "Submit"}
								</button>
							)}
						</>
					)}
				</div>
			</div>

			{validationErrors.length > 0 && <ValidationBanner errors={validationErrors} />}
			{error && (
				<div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
					{error}
				</div>
			)}

			{(doc.taxi_po_name || doc.crusher_po_name || doc.delivery_note_name) && (
				<div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
					<p className="font-medium text-gray-900">Linked documents</p>
					<ul className="mt-2 space-y-1">
						{doc.taxi_po_name && (
							<li>
								Taxi PO:{" "}
								<a
									href={`/app/purchase-order/${encodeURIComponent(doc.taxi_po_name)}`}
									className="text-emerald-700 hover:underline"
								>
									{doc.taxi_po_name}
								</a>
							</li>
						)}
						{doc.crusher_po_name && (
							<li>
								Crusher PO:{" "}
								<a
									href={`/app/purchase-order/${encodeURIComponent(doc.crusher_po_name)}`}
									className="text-emerald-700 hover:underline"
								>
									{doc.crusher_po_name}
								</a>
							</li>
						)}
						{doc.delivery_note_name && (
							<li>
								Delivery Note:{" "}
								<a
									href={`/app/delivery-note/${encodeURIComponent(doc.delivery_note_name)}`}
									className="text-emerald-700 hover:underline"
								>
									{doc.delivery_note_name}
								</a>
							</li>
						)}
					</ul>
				</div>
			)}

			<FormSection title="Basic Info">
				<div className="grid gap-4 md:grid-cols-2">
					<LinkField
						label="Project"
						doctype="Project"
						value={doc.project || ""}
						onChange={handleProjectChange}
						required
						disabled={isReadOnly}
						returnTo={returnPath}
						selectField="project"
					/>
					<LinkField
						label="Company"
						doctype="Company"
						value={doc.company || ""}
						onChange={(value) => setField("company", value)}
						required
						disabled={isReadOnly}
						allowCreate={false}
					/>
				</div>
			</FormSection>

			<FormSection title="Taxi PO">
				<div className="mb-4 grid gap-4 md:grid-cols-2">
					<LinkField
						label="Taxi Supplier"
						doctype="Supplier"
						value={doc.taxi || ""}
						onChange={(value) => setField("taxi", value)}
						required
						disabled={isReadOnly}
						returnTo={returnPath}
						selectField="taxi"
					/>
					<FormField label="Date" required>
						<TextInput
							type="date"
							value={doc.taxi_date || ""}
							disabled={isReadOnly}
							onChange={(value) => setField("taxi_date", value)}
						/>
					</FormField>
					<FormField label="Taxi Invoice">
						<TextInput
							value={doc.taxi_invoice || ""}
							disabled={isReadOnly}
							onChange={(value) => setField("taxi_invoice", value)}
						/>
					</FormField>
					<FormField label="Taxi Invoice Date">
						<TextInput
							type="date"
							value={doc.taxi_invoice_date || ""}
							disabled={isReadOnly}
							onChange={(value) => setField("taxi_invoice_date", value)}
						/>
					</FormField>
					{showTaxiPettyCash && (
						<>
							<LinkField
								label="Petty Cash Account"
								doctype="Petty Cash Account"
								value={doc.taxi_petty_cash_account || ""}
								onChange={(value) => setField("taxi_petty_cash_account", value)}
								required
								disabled={isReadOnly}
								allowCreate={false}
							/>
							<LinkField
								label="Petty Cash Account Head"
								doctype="Petty Cash Account Head"
								value={doc.taxi_petty_cash_account_head || ""}
								onChange={(value) => setField("taxi_petty_cash_account_head", value)}
								required
								disabled={isReadOnly}
								allowCreate={false}
							/>
						</>
					)}
					<div className="md:col-span-2">
						<AttachField
							label="Taxi Attachment"
							value={doc.taxi_attachement}
							onChange={(value) => setField("taxi_attachement", value)}
							disabled={isReadOnly}
							doctype="Master Data"
							docname={doc.name}
							fieldname="taxi_attachement"
						/>
					</div>
					<label className="flex items-center gap-2 text-sm text-gray-700 md:col-span-2">
						<input
							type="checkbox"
							checked={!!doc.crusher_included}
							disabled={isReadOnly}
							className="rounded border-gray-300"
							onChange={(e) => handleCrusherIncludedChange(e.target.checked)}
						/>
						Include crusher in taxi PO
					</label>
				</div>

				<div className="space-y-4">
					<div>
						<p className="mb-2 text-sm font-medium text-gray-700">
							Items <span className="text-red-500">*</span>
						</p>
						<LineItemsTable
							value={doc.taxi_items}
							onChange={(rows) => setField("taxi_items", rows)}
							columns={PO_ITEM_COLUMNS}
							childDoctype="Purchase Order Item"
							disabled={isReadOnly}
							defaultRow={{ schedule_date: doc.taxi_date || "" }}
							itemDetailsContext={taxiItemContext}
						/>
					</div>
					<div>
						<p className="mb-2 text-sm font-medium text-gray-700">Taxes</p>
						<TaxesTable
							value={doc.taxi_taxes}
							onChange={(rows) => setField("taxi_taxes", rows)}
							disabled={isReadOnly}
							showPettyCash
							parentfield="taxi_taxes"
						/>
					</div>
					<FormField label="Grand Total">
						<CurrencyDisplay value={doc.taxi_grand_total} />
					</FormField>
				</div>
			</FormSection>

			{!doc.crusher_included && (
				<FormSection title="Crusher PO">
					<div className="mb-4 grid gap-4 md:grid-cols-2">
						<LinkField
							label="Crusher Supplier"
							doctype="Supplier"
							value={doc.crusher || ""}
							onChange={(value) => setField("crusher", value)}
							required
							disabled={isReadOnly}
							returnTo={returnPath}
							selectField="crusher"
						/>
						<FormField label="Date" required>
							<TextInput
								type="date"
								value={doc.crusher_date || ""}
								disabled={isReadOnly}
								onChange={(value) => setField("crusher_date", value)}
							/>
						</FormField>
						<FormField label="Crusher Reference">
							<TextInput
								value={doc.crusher_reference || ""}
								disabled={isReadOnly}
								onChange={(value) => setField("crusher_reference", value)}
							/>
						</FormField>
						<FormField label="Payment">
							<select
								value={doc.custom_payment || ""}
								disabled={isReadOnly}
								className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:bg-gray-50"
								onChange={(e) => setField("custom_payment", e.target.value)}
							>
								<option value="">Select</option>
								<option value="Cash">Cash</option>
								<option value="Credit">Credit</option>
							</select>
						</FormField>
						{showCrusherPettyCash && (
							<>
								<LinkField
									label="Petty Cash Account"
									doctype="Petty Cash Account"
									value={doc.crusher_petty_cash_account || ""}
									onChange={(value) => setField("crusher_petty_cash_account", value)}
									required
									disabled={isReadOnly}
									allowCreate={false}
								/>
								<LinkField
									label="Petty Cash Account Head"
									doctype="Petty Cash Account Head"
									value={doc.crusher_petty_cash_account_head || ""}
									onChange={(value) =>
										setField("crusher_petty_cash_account_head", value)
									}
									required
									disabled={isReadOnly}
									allowCreate={false}
								/>
							</>
						)}
						<div className="md:col-span-2">
							<AttachField
								label="Crusher Attachment"
								value={doc.crusher_attachement}
								onChange={(value) => setField("crusher_attachement", value)}
								disabled={isReadOnly}
								doctype="Master Data"
								docname={doc.name}
								fieldname="crusher_attachement"
							/>
						</div>
					</div>

					<div className="space-y-4">
						<div>
							<p className="mb-2 text-sm font-medium text-gray-700">
								Items <span className="text-red-500">*</span>
							</p>
							<LineItemsTable
								value={doc.crusher_items}
								onChange={(rows) => setField("crusher_items", rows)}
								columns={PO_ITEM_COLUMNS}
								childDoctype="Purchase Order Item"
								disabled={isReadOnly}
								defaultRow={{ schedule_date: doc.crusher_date || "" }}
								itemDetailsContext={crusherItemContext}
							/>
						</div>
						<div>
							<p className="mb-2 text-sm font-medium text-gray-700">Taxes</p>
							<TaxesTable
								value={doc.crusher_taxes}
								onChange={(rows) => setField("crusher_taxes", rows)}
								disabled={isReadOnly}
								parentfield="crusher_taxes"
							/>
						</div>
						<FormField label="Grand Total">
							<CurrencyDisplay value={doc.crusher_grand_total} />
						</FormField>
					</div>
				</FormSection>
			)}

			<FormSection title="Delivery Order">
				<div className="mb-4 grid gap-4 md:grid-cols-3">
					<LinkField
						label="Customer"
						doctype="Customer"
						value={doc.customer || ""}
						onChange={(value) => setField("customer", value)}
						required
						disabled={isReadOnly}
						returnTo={returnPath}
						selectField="customer"
					/>
					<FormField label="Date" required>
						<TextInput
							type="date"
							value={doc.date || ""}
							disabled={isReadOnly}
							onChange={(value) => setField("date", value)}
						/>
					</FormField>
					<FormField label="Time">
						<TextInput
							type="time"
							value={doc.time || ""}
							disabled={isReadOnly}
							onChange={(value) => setField("time", value)}
						/>
					</FormField>
					<FormField label="DO Number">
						<TextInput
							value={doc.do_number || ""}
							disabled={isReadOnly}
							onChange={(value) => setField("do_number", value)}
						/>
					</FormField>
					<FormField label="Vehicle Number">
						<TextInput
							value={doc.vehicle_number || ""}
							disabled={isReadOnly}
							onChange={(value) => setField("vehicle_number", value)}
						/>
					</FormField>
					<div className="md:col-span-3">
						<AttachField
							label="DO Attachment"
							value={doc.do_attachement}
							onChange={(value) => setField("do_attachement", value)}
							disabled={isReadOnly}
							doctype="Master Data"
							docname={doc.name}
							fieldname="do_attachement"
						/>
					</div>
				</div>

				<div className="space-y-4">
					<div>
						<p className="mb-2 text-sm font-medium text-gray-700">
							Items <span className="text-red-500">*</span>
						</p>
						<LineItemsTable
							value={doc.items}
							onChange={(rows) => setField("items", rows)}
							columns={DN_ITEM_COLUMNS}
							childDoctype="Delivery Note Item"
							disabled={isReadOnly}
							itemDetailsContext={deliveryItemContext}
						/>
					</div>
					<div>
						<p className="mb-2 text-sm font-medium text-gray-700">Taxes</p>
						<TaxesTable
							value={doc.taxes}
							onChange={(rows) => setField("taxes", rows)}
							disabled={isReadOnly}
							parentfield="taxes"
						/>
					</div>
					<FormField label="Grand Total">
						<CurrencyDisplay value={doc.do_grand_total} />
					</FormField>
				</div>
			</FormSection>
		</div>
	);
}
