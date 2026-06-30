import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import {
	FrappeApiError,
	getLoggedUser,
	loginWithPassword,
	logoutSession,
} from "@/lib/frappe-api";

interface AuthContextValue {
	user: string | null;
	isLoading: boolean;
	isAuthenticated: boolean;
	login: (username: string, password: string) => Promise<void>;
	logout: () => Promise<void>;
	refresh: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeUser(user: string | null | undefined): string | null {
	if (!user || user === "Guest") {
		return null;
	}
	return user;
}

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	const refresh = useCallback(async () => {
		try {
			const loggedInUser = normalizeUser(await getLoggedUser());
			setUser(loggedInUser);
			return loggedInUser;
		} catch {
			setUser(null);
			return null;
		}
	}, []);

	useEffect(() => {
		refresh().finally(() => setIsLoading(false));
	}, [refresh]);

	const login = useCallback(async (username: string, password: string) => {
		await loginWithPassword(username, password);
		const loggedInUser = normalizeUser(await getLoggedUser());
		if (!loggedInUser) {
			throw new FrappeApiError(
				"Login succeeded but the session was not saved. Hard-refresh and try again.",
			);
		}
		flushSync(() => {
			setUser(loggedInUser);
			setIsLoading(false);
		});
	}, []);

	const logout = useCallback(async () => {
		try {
			await logoutSession();
		} finally {
			flushSync(() => {
				setUser(null);
				setIsLoading(false);
			});
		}
	}, []);

	const value = useMemo(
		() => ({
			user,
			isLoading,
			isAuthenticated: !!user,
			login,
			logout,
			refresh,
		}),
		[user, isLoading, login, logout, refresh],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error("useAuth must be used within AuthProvider");
	}
	return context;
}
