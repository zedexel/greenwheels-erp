import { BrowserRouter } from "react-router-dom";
import { AppRouter } from "./router";

export default function App() {
	return (
		<BrowserRouter basename="/greenwheels">
			<AppRouter />
		</BrowserRouter>
	);
}
