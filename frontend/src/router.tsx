import { Navigate, Route, Routes, useParams } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { GuestRoute, ProtectedRoute } from "@/components/AuthGuard";
import Dashboard from "@/pages/Dashboard";
import Login from "@/pages/Login";
import MasterDataForm from "@/pages/MasterDataForm";
import MasterDataList from "@/pages/MasterDataList";
import MasterEntityForm from "@/pages/masters/MasterEntityForm";
import MasterEntityList from "@/pages/masters/MasterEntityList";

function MasterDataRoute() {
	const { name } = useParams();
	if (name === "new") {
		return <Navigate to="/master-data/create" replace />;
	}
	return <MasterDataForm />;
}

export function AppRouter() {
	return (
		<Routes>
			<Route element={<GuestRoute />}>
				<Route path="/account/login" element={<Login />} />
			</Route>

			<Route element={<ProtectedRoute />}>
				<Route element={<AppLayout />}>
					<Route index element={<Dashboard />} />
					<Route path="master-data" element={<MasterDataList />} />
					<Route path="master-data/create" element={<MasterDataForm />} />
					<Route path="master-data/:name" element={<MasterDataRoute />} />
					<Route path="masters/:entityKey" element={<MasterEntityList />} />
					<Route path="masters/:entityKey/new" element={<MasterEntityForm />} />
					<Route path="masters/:entityKey/:name" element={<MasterEntityForm />} />
				</Route>
			</Route>
		</Routes>
	);
}
