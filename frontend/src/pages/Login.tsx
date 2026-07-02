import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FrappeApiError } from "@/lib/frappe-api";
import { useAuth } from "@/lib/auth";
import logoFullUrl from "@/assets/logo-full.png";

export default function Login() {
	const navigate = useNavigate();
	const { login, isAuthenticated } = useAuth();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (isAuthenticated) {
			navigate("/", { replace: true });
		}
	}, [isAuthenticated, navigate]);

	async function submit(event: FormEvent) {
		event.preventDefault();
		setError(null);
		setLoading(true);
		try {
			await login(email, password);
		} catch (err) {
			const message =
				err instanceof FrappeApiError || err instanceof Error
					? err.message
					: "Invalid login credentials";
			setError(message);
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-emerald-950 px-4">
			<div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
				<div className="mb-6 flex justify-center">
					<img
						src={logoFullUrl}
						alt="Green Wheels Transport and General Contracting"
						className="h-14 w-full max-w-sm object-contain"
					/>
				</div>
				<p className="mb-6 text-center text-sm text-gray-500">Sign in to continue</p>

				<form className="flex flex-col space-y-4" onSubmit={submit}>
					<div>
						<label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
							User ID
						</label>
						<input
							id="email"
							required
							type="text"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="Administrator"
							className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
						/>
					</div>
					<div>
						<label
							htmlFor="password"
							className="mb-1 block text-sm font-medium text-gray-700"
						>
							Password
						</label>
						<input
							id="password"
							required
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="••••••"
							className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
						/>
					</div>
					{error && (
						<p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
					)}
					<button
						type="submit"
						disabled={loading}
						className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{loading ? "Signing in..." : "Login"}
					</button>
				</form>
			</div>
		</div>
	);
}
