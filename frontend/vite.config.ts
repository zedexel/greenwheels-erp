import path from "node:path";
import fs from "node:fs";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import proxyOptions, { default_site } from "./proxyOptions.js";

const FRAPPE_ASSET_BASE = "/assets/greenwheels/greenwheels/";
const DEV_BASE = "/greenwheels/";
const OUT_DIR = path.resolve(__dirname, "../greenwheels/public/greenwheels");
const WWW_HTML = path.resolve(__dirname, "../greenwheels/www/greenwheels.html");

function redirectToApp() {
	return {
		name: "greenwheels-redirect-root",
		configureServer(server: {
			middlewares: {
				use: (
					fn: (
						req: { url?: string },
						res: { writeHead: (code: number, headers: Record<string, string>) => void; end: () => void },
						next: () => void,
					) => void,
				) => void;
			};
		}) {
			server.middlewares.use((req, res, next) => {
				if (req.url === "/" || req.url === "") {
					res.writeHead(302, { Location: "/greenwheels/" });
					res.end();
					return;
				}
				next();
			});
		},
	};
}

function writeFrappeWwwHtml(): Plugin {
	return {
		name: "write-frappe-www-html",
		closeBundle() {
			const html = `---
safe_render: false
---

<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<link rel="icon" href="${FRAPPE_ASSET_BASE}icon.svg" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>Green Wheels</title>
	</head>
	<body>
		<div id="root"></div>
		<script>
			{% for key in boot %}
			window["{{ key }}"] = {{ boot[key] | tojson }};
			{% endfor %}
		</script>
		<script src="${FRAPPE_ASSET_BASE}assets/index.js"></script>
	</body>
</html>
`;
			fs.writeFileSync(WWW_HTML, html);
		},
	};
}

export default defineConfig(({ command }) => ({
	base: command === "serve" ? DEV_BASE : FRAPPE_ASSET_BASE,
	plugins: [redirectToApp(), react(), command === "build" ? writeFrappeWwwHtml() : null].filter(Boolean),
	define: {
		__SITE_NAME__: JSON.stringify(default_site),
	},
	server: {
		port: 8080,
		host: "0.0.0.0",
		allowedHosts: true,
		proxy: proxyOptions,
		open: "/greenwheels/",
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "src"),
		},
	},
	build: {
		outDir: OUT_DIR,
		emptyOutDir: true,
		target: "es2015",
		rollupOptions: {
			output: {
				format: "iife",
				name: "GreenWheelsApp",
				inlineDynamicImports: true,
				entryFileNames: "assets/index.js",
				chunkFileNames: "assets/[name].js",
				assetFileNames: "assets/[name][extname]",
			},
		},
	},
}));
