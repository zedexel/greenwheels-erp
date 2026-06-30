import { useEffect, useState } from "react";
import { frappeCall } from "@/lib/frappe-api";

interface UseFrappeMethodResult<T> {
	data: T | null;
	isLoading: boolean;
	error: string | null;
}

export function useFrappeMethod<T>(
	method: string,
	params: Record<string, unknown>,
	cacheKey: string,
	enabled = true,
): UseFrappeMethodResult<T> {
	const [data, setData] = useState<T | null>(null);
	const [isLoading, setIsLoading] = useState(enabled);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!enabled) {
			setIsLoading(false);
			return;
		}

		let cancelled = false;
		setIsLoading(true);
		setError(null);

		frappeCall<T>(method, params)
			.then((result) => {
				if (!cancelled) {
					setData(result);
				}
			})
			.catch((err: unknown) => {
				if (!cancelled) {
					setData(null);
					setError(err instanceof Error ? err.message : "Request failed");
				}
			})
			.finally(() => {
				if (!cancelled) {
					setIsLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [method, cacheKey, enabled]);

	return { data, isLoading, error };
}
