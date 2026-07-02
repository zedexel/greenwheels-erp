type FrappeResponse<T> = {
	message?: T;
	exc?: string;
	_exc_source?: string;
};

export class FrappeApiError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "FrappeApiError";
	}
}

async function parseFrappeResponse<T>(response: Response): Promise<T> {
	const data = (await response.json()) as FrappeResponse<T> & {
		_server_messages?: string;
	};

	if (!response.ok || data.exc) {
		let message = "Request failed";
		if (typeof data.message === "string") {
			message = data.message;
		} else if (data._server_messages) {
			try {
				const parsed = JSON.parse(data._server_messages) as { message?: string }[];
				message = parsed[0]?.message ?? message;
			} catch {
				// keep default
			}
		}
		throw new FrappeApiError(message);
	}

	return data.message as T;
}

function buildQuery(params: Record<string, unknown>): string {
	const query = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value === undefined || value === null) {
			continue;
		}
		if (typeof value === "object") {
			query.set(key, JSON.stringify(value));
		} else {
			query.set(key, String(value));
		}
	}
	return query.toString();
}

export async function frappeCall<T>(
	method: string,
	params: Record<string, unknown> = {},
): Promise<T> {
	const query = buildQuery(params);
	const url = query ? `/api/method/${method}?${query}` : `/api/method/${method}`;
	const response = await fetch(url, { credentials: "include" });
	return parseFrappeResponse<T>(response);
}

export async function frappePost<T>(
	method: string,
	body: Record<string, unknown> = {},
): Promise<T> {
	const response = await fetch(`/api/method/${method}`, {
		method: "POST",
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
		},
		body: JSON.stringify(body),
	});
	return parseFrappeResponse<T>(response);
}

export interface SearchLinkResult {
	value: string;
	description?: string;
}

export interface SearchLinkOptions {
	filters?: Record<string, unknown>;
	query?: string;
	pageLength?: number;
	referenceDoctype?: string;
	ignoreUserPermissions?: boolean;
}

export async function searchLink(
	doctype: string,
	txt: string,
	options: SearchLinkOptions = {},
): Promise<SearchLinkResult[]> {
	const {
		filters,
		query,
		pageLength = 10,
		referenceDoctype,
		ignoreUserPermissions = false,
	} = options;

	const params: Record<string, unknown> = {
		doctype,
		txt,
		filters: filters ?? {},
		page_length: pageLength,
		ignore_user_permissions: ignoreUserPermissions ? 1 : 0,
	};
	if (query) {
		params.query = query;
	}
	if (referenceDoctype) {
		params.reference_doctype = referenceDoctype;
	}

	const results = await frappeCall<SearchLinkResult[]>("frappe.desk.search.search_link", params);
	return Array.isArray(results) ? results : [];
}

export async function uploadFile(
	file: File,
	options: { doctype?: string; docname?: string; fieldname?: string },
): Promise<string> {
	const formData = new FormData();
	formData.append("file", file);
	if (options.doctype) formData.append("doctype", options.doctype);
	if (options.docname) formData.append("docname", options.docname);
	if (options.fieldname) formData.append("fieldname", options.fieldname);
	formData.append("is_private", "0");

	const response = await fetch("/api/method/upload_file", {
		method: "POST",
		credentials: "include",
		body: formData,
	});

	const data = (await response.json()) as FrappeResponse<{ file_url?: string }> & {
		_server_messages?: string;
	};

	if (!response.ok || data.exc) {
		let message = "Upload failed";
		if (data._server_messages) {
			try {
				const parsed = JSON.parse(data._server_messages) as { message?: string }[];
				message = parsed[0]?.message ?? message;
			} catch {
				// keep default
			}
		}
		throw new FrappeApiError(message);
	}

	const fileUrl = data.message?.file_url;
	if (!fileUrl) {
		throw new FrappeApiError("Upload failed: no file URL returned");
	}
	return fileUrl;
}

export async function getLoggedUser(): Promise<string> {
	return frappeCall<string>("frappe.auth.get_logged_user");
}

export async function loginWithPassword(usr: string, pwd: string): Promise<void> {
	const response = await fetch("/api/method/login", {
		method: "POST",
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
		},
		body: JSON.stringify({ usr, pwd }),
	});
	await parseFrappeResponse(response);
}

export async function logoutSession(): Promise<void> {
	const response = await fetch("/api/method/logout", {
		method: "POST",
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
		},
		body: JSON.stringify({}),
	});
	await parseFrappeResponse(response);
}
