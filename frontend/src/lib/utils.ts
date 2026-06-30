export function isAuthenticated(user: string | null | undefined): boolean {
	return !!user && user !== "Guest";
}

export function statusLabel(docstatus: number): string {
	if (docstatus === 1) return "Submitted";
	if (docstatus === 2) return "Cancelled";
	return "Draft";
}

export function statusClass(docstatus: number): string {
	if (docstatus === 1) return "bg-emerald-100 text-emerald-800";
	if (docstatus === 2) return "bg-red-100 text-red-800";
	return "bg-orange-100 text-orange-800";
}

export function formatDate(value?: string): string {
	if (!value) return "—";
	return new Date(value).toLocaleString();
}

export interface MasterDataRow {
	name: string;
	project?: string;
	project_name?: string;
	company?: string;
	docstatus: number;
	modified?: string;
}
