import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
	referenceDoctype?: string;
	pageLength?: number;
	dropdownPlacement?: "above" | "below";
}

interface MenuPosition {
	left: number;
	width: number;
	top?: number;
	bottom?: number;
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
	referenceDoctype,
	pageLength = 10,
	dropdownPlacement = "below",
}: LinkFieldProps) {
	const navigate = useNavigate();
	const [searchText, setSearchText] = useState(value || "");
	const [results, setResults] = useState<{ value: string; description?: string }[]>([]);
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const createPath = getMasterCreatePath(doctype);
	const showCreateFooter = allowCreate && !disabled && !!createPath;
	const usePortal = dropdownPlacement === "above";

	const updateMenuPosition = useCallback(() => {
		const input = inputRef.current;
		if (!input) return;

		const rect = input.getBoundingClientRect();
		const base = { left: rect.left, width: rect.width };

		if (dropdownPlacement === "above") {
			setMenuPosition({
				...base,
				bottom: window.innerHeight - rect.top + 4,
			});
		} else {
			setMenuPosition({
				...base,
				top: rect.bottom + 4,
			});
		}
	}, [dropdownPlacement]);

	useEffect(() => {
		setSearchText(value || "");
	}, [value]);

	useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
				const target = event.target as HTMLElement;
				if (!target.closest("[data-linkfield-menu]")) {
					setOpen(false);
				}
			}
		}
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	useEffect(() => {
		if (!open) {
			setMenuPosition(null);
			return;
		}

		updateMenuPosition();

		window.addEventListener("scroll", updateMenuPosition, true);
		window.addEventListener("resize", updateMenuPosition);

		return () => {
			window.removeEventListener("scroll", updateMenuPosition, true);
			window.removeEventListener("resize", updateMenuPosition);
		};
	}, [open, updateMenuPosition]);

	useEffect(() => {
		if (!open) return;

		const timer = setTimeout(async () => {
			setLoading(true);
			try {
				const items = await searchLink(doctype, searchText, {
					filters,
					query: linkQuery,
					pageLength,
					referenceDoctype,
				});
				setResults(items);
			} catch {
				setResults([]);
			} finally {
				setLoading(false);
			}
		}, 250);

		return () => clearTimeout(timer);
	}, [searchText, doctype, filters, linkQuery, referenceDoctype, pageLength, open]);

	useEffect(() => {
		if (open) updateMenuPosition();
	}, [results.length, loading, open, updateMenuPosition]);

	function selectItem(itemValue: string) {
		onChange(itemValue);
		setSearchText(itemValue);
		setOpen(false);
	}

	function handleCreate() {
		if (!createPath) return;

		setOpen(false);

		const params = new URLSearchParams();
		if (returnTo) params.set("returnTo", returnTo);
		if (selectField) params.set("selectField", selectField);

		const queryString = params.toString();
		navigate(queryString ? `${createPath}?${queryString}` : createPath);
	}

	function renderDropdown() {
		if (!open || disabled) return null;

		const menu = (
			<div
				data-linkfield-menu
				className={`overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg ${
					usePortal ? "fixed z-[100]" : "absolute z-20 mt-1 w-full"
				}`}
				style={
					usePortal && menuPosition
						? {
								left: menuPosition.left,
								width: menuPosition.width,
								top: menuPosition.top,
								bottom: menuPosition.bottom,
							}
						: undefined
				}
			>
				<div className="max-h-48 overflow-auto">
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
				{showCreateFooter && (
					<button
						type="button"
						className="block w-full border-t border-gray-200 px-3 py-2.5 text-left text-sm font-medium text-emerald-700 hover:bg-emerald-50"
						onClick={handleCreate}
					>
						+ Create a new {doctype}
					</button>
				)}
			</div>
		);

		if (usePortal) {
			return menuPosition ? createPortal(menu, document.body) : null;
		}

		return menu;
	}

	return (
		<div ref={containerRef} className="relative">
			{label ? (
				<label className="mb-1 block text-sm font-medium text-gray-700">
					{label}
					{required && <span className="text-red-500"> *</span>}
				</label>
			) : null}
			<input
				ref={inputRef}
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
			{renderDropdown()}
		</div>
	);
}
