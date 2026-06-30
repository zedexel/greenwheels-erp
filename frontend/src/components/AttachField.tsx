import { useRef, useState } from "react";
import { uploadFile } from "@/lib/frappe-api";

interface AttachFieldProps {
	label: string;
	value?: string;
	onChange: (fileUrl: string) => void;
	disabled?: boolean;
	doctype?: string;
	docname?: string;
	fieldname?: string;
}

export default function AttachField({
	label,
	value,
	onChange,
	disabled,
	doctype,
	docname,
	fieldname,
}: AttachFieldProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		if (!file) return;

		setUploading(true);
		setError(null);
		try {
			const fileUrl = await uploadFile(file, { doctype, docname, fieldname });
			onChange(fileUrl);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Upload failed");
		} finally {
			setUploading(false);
			if (inputRef.current) inputRef.current.value = "";
		}
	}

	return (
		<div>
			<label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
			<div className="flex flex-wrap items-center gap-3">
				<input
					ref={inputRef}
					type="file"
					disabled={disabled || uploading}
					className="text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-emerald-800 hover:file:bg-emerald-100 disabled:opacity-50"
					onChange={handleFileChange}
				/>
				{uploading && <span className="text-sm text-gray-500">Uploading...</span>}
			</div>
			{value && (
				<a
					href={value}
					target="_blank"
					rel="noreferrer"
					className="mt-2 inline-block text-sm text-emerald-700 hover:underline"
				>
					View attachment
				</a>
			)}
			{error && <p className="mt-1 text-sm text-red-600">{error}</p>}
		</div>
	);
}
