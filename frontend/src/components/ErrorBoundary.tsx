import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
	children: ReactNode;
}

interface ErrorBoundaryState {
	error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	state: ErrorBoundaryState = { error: null };

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { error };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		console.error("Green Wheels UI error:", error, info);
	}

	render() {
		if (this.state.error) {
			return (
				<div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
					<div className="max-w-lg rounded-xl border border-red-200 bg-white p-6 shadow-sm">
						<h1 className="text-lg font-semibold text-gray-900">Something went wrong</h1>
						<p className="mt-2 text-sm text-gray-600">{this.state.error.message}</p>
						<button
							type="button"
							className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
							onClick={() => window.location.reload()}
						>
							Reload page
						</button>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}
