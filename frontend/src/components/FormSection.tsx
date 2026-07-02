import { statusClass, statusLabel } from "@/lib/utils";

export function FormSection({
	title,
	id,
	children,
}: {
	title: string;
	id?: string;
	children: React.ReactNode;
}) {
	return (
		<section
			id={id}
			className="scroll-mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
		>
			<h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
				{title}
			</h2>
			{children}
		</section>
	);
}

export function StatusBadge({ docstatus = 0 }: { docstatus?: number }) {
	return (
		<span
			className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass(docstatus)}`}
		>
			{statusLabel(docstatus)}
		</span>
	);
}

export function ValidationBanner({ errors }: { errors: string[] }) {
	if (!errors.length) return null;

	return (
		<div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
			<p className="font-medium">Please fix the following before saving:</p>
			<ul className="mt-2 list-disc space-y-1 pl-5">
				{errors.map((error) => (
					<li key={error}>{error}</li>
				))}
			</ul>
		</div>
	);
}

export function FormField({
	label,
	required,
	children,
}: {
	label: string;
	required?: boolean;
	children: React.ReactNode;
}) {
	return (
		<div>
			<label className="mb-1 block text-sm font-medium text-gray-700">
				{label}
				{required && <span className="text-red-500"> *</span>}
			</label>
			{children}
		</div>
	);
}

export function TextInput({
	value,
	onChange,
	type = "text",
	disabled,
}: {
	value?: string;
	onChange: (value: string) => void;
	type?: string;
	disabled?: boolean;
}) {
	return (
		<input
			type={type}
			value={value || ""}
			disabled={disabled}
			className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:bg-gray-50"
			onChange={(e) => onChange(e.target.value)}
		/>
	);
}

export function CurrencyDisplay({ value }: { value?: number }) {
	return (
		<div className="rounded-lg bg-gray-50 px-4 py-3 text-lg font-semibold text-gray-900">
			{value != null ? Number(value).toFixed(2) : "0.00"}
		</div>
	);
}

export function CurrencyCell({ value }: { value?: number | string | null }) {
	const formatted =
		value === undefined || value === null || value === ""
			? "0.00"
			: Number(value).toFixed(2);

	return (
		<div className="rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-right text-sm text-gray-900">
			{formatted}
		</div>
	);
}

export function ReadOnlyCell({ value }: { value?: string | number | null }) {
	return (
		<div className="rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-gray-900">
			{value ?? ""}
		</div>
	);
}
