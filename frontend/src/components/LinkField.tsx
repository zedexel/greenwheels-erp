import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { searchLink } from "@/lib/frappe-api";
import { getMasterCreatePath } from "@/config/masters";

interface LinkFieldProps {
	label: string;
	doctype: string;
	value?: string;
	onChange: (value: string) => void;
	required?: boolean;
	disabled?: boolean;
	placeholder?: string;
	filters?: Record<string, unknown>;
	linkQuery?: string;
	allowCreate?: boolean;
	returnTo?: string;
	selectField?: string;
}

export default function LinkField({
	label,
	doctype,
	value,
	onChange,
	required,
	disabled,
	placeholder = "",
	filters,
	linkQuery,
	allowCreate = true,
	returnTo,
	selectField,
}: LinkFieldProps) {
	const navigate = useNavigate();
	const [searchText, setSearchText] = useState(value || "");
	const [results, setResults] = useState<{ value: string; description?: string }[]>([]);
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		setSearchText(value || "");
	}, [value]);

	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
				setOpen(false);
			}
		}
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	useEffect(() => {
		if (!open) return;

		const timer = setTimeout(async () => {
			setLoading(true);
			try {
				const items = await searchLink(doctype, searchText, filters, linkQuery);
				setResults(items);
			} catch {
				setResults([]);
			} finally {
				setLoading(false);
			}
		}, 250);

		return () => clearTimeout(timer);
	}, [searchText, doctype, filters, linkQuery, open]);

	function selectItem(itemValue: string) {
		onChange(itemValue);
		setSearchText(itemValue);
		setOpen(false);
	}

	function handleCreate() {
		const path = getMasterCreatePath(doctype);
		if (!path) return;

		const params = new URLSearchParams();
		if (returnTo) params.set("returnTo", returnTo);
		if (selectField) params.set("selectField", selectField);

		const queryString = params.toString();
		navigate(queryString ? `${path}?${queryString}` : path);
	}

	return (
		<div ref={containerRef} className="relative">
			{label ? (
				<label className="mb-1 block text-sm font-medium text-gray-700">
					{label}
					{required && <span className="text-red-500"> *</span>}
				</label>
			) : null}
			<div className="flex gap-2">
				<input
					type="text"
					value={searchText}
					disabled={disabled}
					placeholder={placeholder}
					className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:bg-gray-50"
					onFocus={() => setOpen(true)}
					onChange={(e) => {
						setSearchText(e.target.value);
						setOpen(true);
						if (!e.target.value) onChange("");
					}}
				/>
				{allowCreate && !disabled && getMasterCreatePath(doctype) && (
					<button
						type="button"
						className="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
						onClick={handleCreate}
					>
						+ New
					</button>
				)}
			</div>
			{open && !disabled && (
				<div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
					{loading ? (
						<div className="px-3 py-2 text-sm text-gray-500">Searching...</div>
					) : results.length === 0 ? (
						<div className="px-3 py-2 text-sm text-gray-500">No results</div>
					) : (
						results.map((item) => (
							<button
								key={item.value}
								type="button"
								className="block w-full px-3 py-2 text-left text-sm hover:bg-emerald-50"
								onClick={() => selectItem(item.value)}
							>
								<div className="font-medium text-gray-900">{item.value}</div>
								{item.description && (
									<div className="text-xs text-gray-500">{item.description}</div>
								)}
							</button>
						))
					)}
				</div>
			)}
		</div>
	);
}
