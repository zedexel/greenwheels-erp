import {
	Building2,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Database,
	Home,
	LogOut,
	Package,
	Truck,
	Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { masterNavItems } from "@/config/masters";
import iconUrl from "@/assets/icon.svg";

const SIDEBAR_STORAGE_KEY = "greenwheels-sidebar-collapsed";

const navItems = [
	{ name: "Dashboard", label: "Dashboard", to: "/", icon: Home },
	{ name: "MasterDataList", label: "Master Data", to: "/master-data", icon: Database },
];

const masterIcons: Record<string, typeof Home> = {
	projects: Building2,
	suppliers: Truck,
	customers: Users,
	items: Package,
};

export default function AppLayout() {
	const location = useLocation();
	const { user, logout } = useAuth();
	const [sidebarCollapsed, setSidebarCollapsed] = useState(
		() => localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true",
	);
	const [mastersOpen, setMastersOpen] = useState(
		() => location.pathname.startsWith("/masters"),
	);

	function toggleSidebar() {
		setSidebarCollapsed((prev) => {
			const next = !prev;
			localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
			return next;
		});
	}

	const { pageTitle, pageSubtitle } = useMemo(() => {
		if (location.pathname.startsWith("/master-data")) {
			return {
				pageTitle: "Master Data",
				pageSubtitle: "Manage project master records",
			};
		}
		if (location.pathname.startsWith("/masters/")) {
			const segment = location.pathname.split("/")[2];
			const master = masterNavItems.find((item) => item.key === segment);
			return {
				pageTitle: master?.label || "Masters",
				pageSubtitle: "Manage reference data",
			};
		}
		return {
			pageTitle: "Dashboard",
			pageSubtitle: "Overview of your operations",
		};
	}, [location.pathname]);

	function isActive(path: string) {
		if (path === "/master-data") {
			return location.pathname.startsWith("/master-data");
		}
		return location.pathname === path;
	}

	const mastersActive = location.pathname.startsWith("/masters");

	return (
		<div className="flex h-screen bg-gray-50">
			<aside
				className={`flex shrink-0 flex-col border-r border-gray-200 bg-white text-gray-900 shadow-sm transition-[width] duration-200 ease-in-out ${
					sidebarCollapsed ? "w-16" : "w-64"
				}`}
			>
				<div
					className={`flex items-center border-b border-gray-200 py-4 ${
						sidebarCollapsed ? "justify-center px-3" : "gap-3 px-5"
					}`}
				>
					<img src={iconUrl} alt="Green Wheels" className="h-9 w-9 shrink-0 rounded-lg" />
					{!sidebarCollapsed && (
						<div className="min-w-0">
							<div className="text-sm font-semibold leading-tight text-gray-900">
								Green Wheels
							</div>
							<div className="text-xs text-gray-500">Transport & Contracting</div>
						</div>
					)}
				</div>

				<nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
					{navItems.map((item) => {
						const Icon = item.icon;
						const active = isActive(item.to);
						return (
							<NavLink
								key={item.name}
								to={item.to}
								title={sidebarCollapsed ? item.label : undefined}
								className={`flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors ${
									sidebarCollapsed ? "justify-center px-2" : "gap-3 px-3"
								} ${
									active
										? "bg-emerald-50 text-emerald-900"
										: "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
								}`}
							>
								<Icon className="h-4 w-4 shrink-0" />
								{!sidebarCollapsed && <span>{item.label}</span>}
							</NavLink>
						);
					})}

					{!sidebarCollapsed ? (
						<div className="pt-2">
							<button
								type="button"
								className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
									mastersActive
										? "bg-emerald-50 text-emerald-900"
										: "text-gray-700 hover:bg-gray-100"
								}`}
								onClick={() => setMastersOpen((open) => !open)}
							>
								<span>Masters</span>
								<ChevronDown
									className={`h-4 w-4 transition-transform ${mastersOpen ? "rotate-180" : ""}`}
								/>
							</button>
							{mastersOpen && (
								<div className="mt-1 space-y-1 pl-2">
									{masterNavItems.map((item) => {
										const Icon = masterIcons[item.key] || Building2;
										const active = location.pathname.startsWith(item.to);
										return (
											<NavLink
												key={item.key}
												to={item.to}
												className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
													active
														? "bg-emerald-50 font-medium text-emerald-900"
														: "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
												}`}
											>
												<Icon className="h-3.5 w-3.5 shrink-0" />
												{item.label}
											</NavLink>
										);
									})}
								</div>
							)}
						</div>
					) : (
						masterNavItems.map((item) => {
							const Icon = masterIcons[item.key] || Building2;
							const active = location.pathname.startsWith(item.to);
							return (
								<NavLink
									key={item.key}
									to={item.to}
									title={item.label}
									className={`flex items-center justify-center rounded-lg py-2.5 text-sm transition-colors ${
										active
											? "bg-emerald-50 text-emerald-900"
											: "text-gray-700 hover:bg-gray-100"
									}`}
								>
									<Icon className="h-4 w-4 shrink-0" />
								</NavLink>
							);
						})
					)}
				</nav>

				<div
					className={`border-t border-gray-200 px-3 py-4 text-xs text-gray-600 ${
						sidebarCollapsed ? "text-center" : "px-5"
					}`}
				>
					{!sidebarCollapsed && (
						<div className="truncate font-medium text-gray-900">{user}</div>
					)}
					<button
						type="button"
						className={`text-gray-600 underline-offset-2 hover:text-gray-900 hover:underline ${
							sidebarCollapsed ? "" : "mt-2"
						}`}
						title={sidebarCollapsed ? "Log out" : undefined}
						onClick={() => logout()}
					>
						{sidebarCollapsed ? (
							<LogOut className="mx-auto h-4 w-4" />
						) : (
							"Log out"
						)}
					</button>
				</div>
			</aside>

			<div className="flex min-w-0 flex-1 flex-col">
				<header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
					<div className="flex items-center gap-3">
						<button
							type="button"
							className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
							aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
							onClick={toggleSidebar}
						>
							{sidebarCollapsed ? (
								<ChevronRight className="h-5 w-5" />
							) : (
								<ChevronLeft className="h-5 w-5" />
							)}
						</button>
						<div>
							<h1 className="text-lg font-semibold text-gray-900">{pageTitle}</h1>
							{pageSubtitle && (
								<p className="text-sm text-gray-500">{pageSubtitle}</p>
							)}
						</div>
					</div>
				</header>

				<main className="flex-1 overflow-auto p-6">
					<Outlet />
				</main>
			</div>
		</div>
	);
}
