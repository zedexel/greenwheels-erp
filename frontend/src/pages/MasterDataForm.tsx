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
import MasterDataSectionNav, {
	MASTER_DATA_SECTIONS,
	type MasterDataSectionId,
} from "@/components/MasterDataSectionNav";
import TaxesTable from "@/components/TaxesTable";
import { frappeCall } from "@/lib/frappe-api";
import {
	applyPoSectionTotals,
	computePoSectionGrandTotal,
	DN_ITEM_COLUMNS,
	emptyMasterDataDoc,
	fetchProjectName,
	PO_ITEM_COLUMNS,
	saveMasterData,
	submitMasterData,
	validateMasterData,
	type LineItemRow,
	type MasterDataDoc,
	type TaxRow,
} from "@/lib/master-data";

interface LocationState {
	selectField?: string;
	selectedValue?: string;
}

const MASTER_DATA_DOCTYPE = "Master Data";

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
	const isScrollingRef = useRef(false);

	const [activeSection, setActiveSection] = useState<MasterDataSectionId>(
		MASTER_DATA_SECTIONS.project,
	);

	const isReadOnly = (doc.docstatus ?? 0) !== 0;
	const showCrusher = !doc.crusher_included;

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

	const setTaxiItems = useCallback((rows: LineItemRow[]) => {
		setDoc((prev) => {
			const totals = applyPoSectionTotals(rows, prev.taxi_taxes);
			return {
				...prev,
				taxi_items: totals.items,
				taxi_taxes: totals.taxes,
				taxi_grand_total: totals.grandTotal,
			};
		});
	}, []);

	const setCrusherItems = useCallback((rows: LineItemRow[]) => {
		setDoc((prev) => {
			const totals = applyPoSectionTotals(rows, prev.crusher_taxes);
			return {
				...prev,
				crusher_items: totals.items,
				crusher_taxes: totals.taxes,
				crusher_grand_total: totals.grandTotal,
			};
		});
	}, []);

	const setTaxiTaxes = useCallback((rows: TaxRow[]) => {
		setDoc((prev) => {
			const totals = applyPoSectionTotals(prev.taxi_items, rows);
			return {
				...prev,
				taxi_items: totals.items,
				taxi_taxes: totals.taxes,
				taxi_grand_total: totals.grandTotal,
			};
		});
	}, []);

	const setCrusherTaxes = useCallback((rows: TaxRow[]) => {
		setDoc((prev) => {
			const totals = applyPoSectionTotals(prev.crusher_items, rows);
			return {
				...prev,
				crusher_items: totals.items,
				crusher_taxes: totals.taxes,
				crusher_grand_total: totals.grandTotal,
			};
		});
	}, []);

	const setDeliveryItems = useCallback((rows: LineItemRow[]) => {
		setDoc((prev) => ({
			...prev,
			items: rows,
			do_grand_total: computePoSectionGrandTotal(rows, prev.taxes),
		}));
	}, []);

	const setDeliveryTaxes = useCallback((rows: TaxRow[]) => {
		setDoc((prev) => ({
			...prev,
			taxes: rows,
			do_grand_total: computePoSectionGrandTotal(prev.items, rows),
		}));
	}, []);

	const taxiGrandTotal = useMemo(
		() => computePoSectionGrandTotal(doc.taxi_items, doc.taxi_taxes),
		[doc.taxi_items, doc.taxi_taxes],
	);

	const crusherGrandTotal = useMemo(
		() => computePoSectionGrandTotal(doc.crusher_items, doc.crusher_taxes),
		[doc.crusher_items, doc.crusher_taxes],
	);

	const deliveryGrandTotal = useMemo(
		() => computePoSectionGrandTotal(doc.items, doc.taxes),
		[doc.items, doc.taxes],
	);

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

	const scrollToSection = useCallback((sectionId: MasterDataSectionId) => {
		setActiveSection(sectionId);
		isScrollingRef.current = true;
		document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
		window.setTimeout(() => {
			isScrollingRef.current = false;
		}, 600);
	}, []);

	useEffect(() => {
		if (!showCrusher && activeSection === MASTER_DATA_SECTIONS.crusher) {
			setActiveSection(MASTER_DATA_SECTIONS.taxi);
		}
	}, [showCrusher, activeSection]);

	useEffect(() => {
		if (loading) return;

		const sectionIds: MasterDataSectionId[] = showCrusher
			? [
					MASTER_DATA_SECTIONS.project,
					MASTER_DATA_SECTIONS.taxi,
					MASTER_DATA_SECTIONS.crusher,
					MASTER_DATA_SECTIONS.customer,
				]
			: [
					MASTER_DATA_SECTIONS.project,
					MASTER_DATA_SECTIONS.taxi,
					MASTER_DATA_SECTIONS.customer,
				];

		const scrollRoot = document.querySelector("main");
		const observer = new IntersectionObserver(
			(entries) => {
				if (isScrollingRef.current) return;

				const visible = entries
					.filter((entry) => entry.isIntersecting)
					.sort((a, b) => b.intersectionRatio - a.intersectionRatio);

				const topmost = entries
					.filter((entry) => entry.isIntersecting && entry.intersectionRatio > 0)
					.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];

				const target = topmost || visible[0];
				if (target?.target.id) {
					setActiveSection(target.target.id as MasterDataSectionId);
				}
			},
			{
				root: scrollRoot,
				rootMargin: "-10% 0px -55% 0px",
				threshold: [0, 0.1, 0.25, 0.5],
			},
		);

		for (const id of sectionIds) {
			const element = document.getElementById(id);
			if (element) observer.observe(element);
		}

		return () => observer.disconnect();
	}, [loading, showCrusher]);

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

		const taxiTotals = applyPoSectionTotals(doc.taxi_items, doc.taxi_taxes);
		const crusherTotals = applyPoSectionTotals(doc.crusher_items, doc.crusher_taxes);
		const deliveryTotals = applyPoSectionTotals(doc.items, doc.taxes);

		const docToSave: MasterDataDoc = {
			...doc,
			taxi_items: taxiTotals.items,
			taxi_taxes: taxiTotals.taxes,
			taxi_grand_total: taxiTotals.grandTotal,
			crusher_items: crusherTotals.items,
			crusher_taxes: crusherTotals.taxes,
			crusher_grand_total: crusherTotals.grandTotal,
			items: deliveryTotals.items,
			taxes: deliveryTotals.taxes,
			do_grand_total: deliveryTotals.grandTotal,
		};

		setSaving(true);
		setError(null);
		try {
			const saved = await saveMasterData(docToSave);
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
		<div className="mx-auto max-w-7xl space-y-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<Link
					to="/master-data"
					className="text-sm font-medium text-emerald-700 hover:underline"
				>
					← Back to list
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

			<div className="flex gap-8">
				<MasterDataSectionNav
					activeSection={activeSection}
					showCrusher={showCrusher}
					onSelect={scrollToSection}
				/>

				<div className="min-w-0 flex-1 space-y-6">
					<FormSection id={MASTER_DATA_SECTIONS.project} title="Basic Info">
				<div className="grid gap-4 md:grid-cols-2">
					<LinkField
						label="Project"
						doctype="Project"
						value={doc.project || ""}
						onChange={handleProjectChange}
						required
						disabled={isReadOnly}
						referenceDoctype={MASTER_DATA_DOCTYPE}
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
						referenceDoctype={MASTER_DATA_DOCTYPE}
						allowCreate={false}
					/>
				</div>
					</FormSection>

					<FormSection id={MASTER_DATA_SECTIONS.taxi} title="Taxi PO">
				<div className="mb-4 grid gap-4 md:grid-cols-2">
					<LinkField
						label="Taxi Supplier"
						doctype="Supplier"
						value={doc.taxi || ""}
						onChange={(value) => setField("taxi", value)}
						required
						disabled={isReadOnly}
						referenceDoctype={MASTER_DATA_DOCTYPE}
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
								referenceDoctype={MASTER_DATA_DOCTYPE}
								allowCreate={false}
							/>
							<LinkField
								label="Petty Cash Account Head"
								doctype="Petty Cash Account Head"
								value={doc.taxi_petty_cash_account_head || ""}
								onChange={(value) => setField("taxi_petty_cash_account_head", value)}
								required
								disabled={isReadOnly}
								referenceDoctype={MASTER_DATA_DOCTYPE}
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
							onChange={setTaxiItems}
							columns={PO_ITEM_COLUMNS}
							childDoctype="Purchase Order Item"
							disabled={isReadOnly}
							defaultRow={{ schedule_date: doc.taxi_date || "" }}
							itemDetailsContext={taxiItemContext}
							referenceDoctype={MASTER_DATA_DOCTYPE}
						/>
					</div>
					<div>
						<p className="mb-2 text-sm font-medium text-gray-700">Taxes</p>
						<TaxesTable
							value={doc.taxi_taxes}
							onChange={setTaxiTaxes}
							disabled={isReadOnly}
							showPettyCash
							parentfield="taxi_taxes"
							referenceDoctype={MASTER_DATA_DOCTYPE}
						/>
					</div>
					<FormField label="Grand Total">
						<CurrencyDisplay value={taxiGrandTotal} />
					</FormField>
				</div>
					</FormSection>

					{showCrusher && (
						<FormSection id={MASTER_DATA_SECTIONS.crusher} title="Crusher PO">
					<div className="mb-4 grid gap-4 md:grid-cols-2">
						<LinkField
							label="Crusher Supplier"
							doctype="Supplier"
							value={doc.crusher || ""}
							onChange={(value) => setField("crusher", value)}
							required
							disabled={isReadOnly}
							referenceDoctype={MASTER_DATA_DOCTYPE}
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
									referenceDoctype={MASTER_DATA_DOCTYPE}
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
									referenceDoctype={MASTER_DATA_DOCTYPE}
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
								onChange={setCrusherItems}
								columns={PO_ITEM_COLUMNS}
								childDoctype="Purchase Order Item"
								disabled={isReadOnly}
								defaultRow={{ schedule_date: doc.crusher_date || "" }}
								itemDetailsContext={crusherItemContext}
								referenceDoctype={MASTER_DATA_DOCTYPE}
							/>
						</div>
						<div>
							<p className="mb-2 text-sm font-medium text-gray-700">Taxes</p>
							<TaxesTable
								value={doc.crusher_taxes}
								onChange={setCrusherTaxes}
								disabled={isReadOnly}
								parentfield="crusher_taxes"
								referenceDoctype={MASTER_DATA_DOCTYPE}
							/>
						</div>
						<FormField label="Grand Total">
							<CurrencyDisplay value={crusherGrandTotal} />
						</FormField>
					</div>
						</FormSection>
					)}

					<FormSection id={MASTER_DATA_SECTIONS.customer} title="Delivery Order">
				<div className="mb-4 grid gap-4 md:grid-cols-3">
					<LinkField
						label="Customer"
						doctype="Customer"
						value={doc.customer || ""}
						onChange={(value) => setField("customer", value)}
						required
						disabled={isReadOnly}
						referenceDoctype={MASTER_DATA_DOCTYPE}
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
							onChange={setDeliveryItems}
							columns={DN_ITEM_COLUMNS}
							childDoctype="Delivery Note Item"
							disabled={isReadOnly}
							itemDetailsContext={deliveryItemContext}
							referenceDoctype={MASTER_DATA_DOCTYPE}
						/>
					</div>
					<div>
						<p className="mb-2 text-sm font-medium text-gray-700">Taxes</p>
						<TaxesTable
							value={doc.taxes}
							onChange={setDeliveryTaxes}
							disabled={isReadOnly}
							parentfield="taxes"
							referenceDoctype={MASTER_DATA_DOCTYPE}
						/>
					</div>
					<FormField label="Grand Total">
						<CurrencyDisplay value={deliveryGrandTotal} />
					</FormField>
				</div>
					</FormSection>
				</div>
			</div>
		</div>
	);
}
