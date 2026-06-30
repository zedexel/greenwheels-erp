import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import LinkField from "@/components/LinkField";
import { FormField, TextInput } from "@/components/FormSection";
import { getMasterConfigByKey } from "@/config/masters";
import { frappeCall, frappePost } from "@/lib/frappe-api";

function emptyDocFromConfig(
	config: ReturnType<typeof getMasterConfigByKey>,
): Record<string, unknown> {
	if (!config) return {};
	const doc: Record<string, unknown> = { doctype: config.doctype };
	for (const field of config.fields) {
		if (field.defaultValue !== undefined) {
			doc[field.name] = field.defaultValue;
		}
	}
	return doc;
}

export default function MasterEntityForm() {
	const { entityKey, name } = useParams<{ entityKey: string; name: string }>();
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();
	const isCreate = !name || name === "new";

	const config = getMasterConfigByKey(entityKey || "");
	const returnTo = searchParams.get("returnTo");
	const selectField = searchParams.get("selectField");

	const [doc, setDoc] = useState<Record<string, unknown>>({});
	const [loading, setLoading] = useState(!isCreate);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const createdName = useMemo(() => {
		if (config?.doctype === "Item") return doc.item_code as string;
		if (config?.nameField) return doc[config.nameField] as string;
		return doc.name as string;
	}, [config, doc]);

	useEffect(() => {
		if (!config) return;

		if (isCreate) {
			setDoc(emptyDocFromConfig(config));
			setLoading(false);
			return;
		}

		setLoading(true);
		frappeCall<Record<string, unknown>>("frappe.client.get", {
			doctype: config.doctype,
			name,
		})
			.then((result) => setDoc(result))
			.catch((err: unknown) => {
				setError(err instanceof Error ? err.message : "Failed to load");
			})
			.finally(() => setLoading(false));
	}, [config, isCreate, name]);

	if (!config) {
		return (
			<div className="rounded-xl border bg-white p-8 text-center text-sm text-gray-500">
				Unknown master type.
			</div>
		);
	}

	function setField(fieldname: string, value: unknown) {
		setDoc((prev) => ({ ...prev, [fieldname]: value }));
	}

	function validate(): string[] {
		const errors: string[] = [];
		for (const field of config.fields) {
			if (field.required && !doc[field.name]) {
				errors.push(`${field.label} is required`);
			}
		}
		return errors;
	}

	async function save() {
		const errors = validate();
		if (errors.length) {
			setError(errors.join(". "));
			return;
		}

		setSaving(true);
		setError(null);
		try {
			let saved: Record<string, unknown>;
			if (isCreate) {
				saved = await frappePost<Record<string, unknown>>("frappe.client.insert", {
					doc,
				});
			} else {
				saved = await frappePost<Record<string, unknown>>("frappe.client.save", {
					doc,
				});
			}

			const selectedName =
				(saved.name as string) ||
				(config.doctype === "Item" ? (saved.item_code as string) : createdName);

			if (returnTo && selectField) {
				navigate(returnTo, {
					state: { selectField, selectedValue: selectedName },
					replace: true,
				});
				return;
			}

			if (isCreate && selectedName) {
				navigate(`${config.listRoute}/${encodeURIComponent(selectedName)}`, {
					replace: true,
				});
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Save failed");
		} finally {
			setSaving(false);
		}
	}

	if (loading) {
		return (
			<div className="rounded-xl border bg-white p-8 text-sm text-gray-500">
				Loading {config.label.toLowerCase()}...
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-2xl space-y-6">
			<div className="flex items-center justify-between">
				<Link
					to={config.listRoute}
					className="text-sm font-medium text-emerald-700 hover:underline"
				>
					← Back to {config.labelPlural}
				</Link>
				<button
					type="button"
					disabled={saving}
					className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
					onClick={save}
				>
					{saving ? "Saving..." : isCreate ? "Create" : "Save"}
				</button>
			</div>

			{error && (
				<div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
					{error}
				</div>
			)}

			<section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
				<h2 className="mb-4 text-lg font-semibold text-gray-900">
					{isCreate ? `New ${config.label}` : String(doc.name || name)}
				</h2>
				<div className="grid gap-4">
					{config.fields.map((field) => {
						if (field.type === "link" && field.linkDoctype) {
							return (
								<LinkField
									key={field.name}
									label={field.label}
									doctype={field.linkDoctype}
									value={String(doc[field.name] || "")}
									onChange={(value) => setField(field.name, value)}
									required={field.required}
									allowCreate={false}
								/>
							);
						}

						if (field.type === "select" && field.options) {
							return (
								<FormField key={field.name} label={field.label} required={field.required}>
									<select
										value={String(doc[field.name] || field.defaultValue || "")}
										className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
										onChange={(e) => setField(field.name, e.target.value)}
									>
										{field.options.map((option) => (
											<option key={option} value={option}>
												{option}
											</option>
										))}
									</select>
								</FormField>
							);
						}

						if (field.type === "checkbox") {
							return (
								<label
									key={field.name}
									className="flex items-center gap-2 text-sm text-gray-700"
								>
									<input
										type="checkbox"
										checked={!!doc[field.name]}
										className="rounded border-gray-300"
										onChange={(e) => setField(field.name, e.target.checked ? 1 : 0)}
									/>
									{field.label}
								</label>
							);
						}

						return (
							<FormField key={field.name} label={field.label} required={field.required}>
								<TextInput
									value={String(doc[field.name] || "")}
									onChange={(value) => setField(field.name, value)}
								/>
							</FormField>
						);
					})}
				</div>
			</section>
		</div>
	);
}
