import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export function ProtectedRoute() {
	const { isAuthenticated, isLoading, user } = useAuth();
	const location = useLocation();

	if (isLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-500">
				Loading...
			</div>
		);
	}

	if (!isAuthenticated || !user) {
		return <Navigate to="/account/login" state={{ from: location }} replace />;
	}

	return <Outlet />;
}

export function GuestRoute() {
	const { isAuthenticated, isLoading } = useAuth();

	if (isLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-emerald-950 text-sm text-emerald-100">
				Loading...
			</div>
		);
	}

	if (isAuthenticated) {
		return <Navigate to="/" replace />;
	}

	return <Outlet />;
}
