const common_site_config = require("../../../sites/common_site_config.json");
const { webserver_port, default_site } = common_site_config;

function resolveSiteName(hostHeader) {
	const host = (hostHeader || "").split(":")[0];
	if (!host || host === "localhost" || host === "127.0.0.1") {
		return default_site;
	}
	return host;
}

function isLocalDevHost(hostHeader) {
	const host = (hostHeader || "").split(":")[0];
	return !host || host === "localhost" || host === "127.0.0.1";
}

/** Strip Domain from Set-Cookie so localhost:8080 can store session cookies. */
function rewriteCookiesForLocalhost(proxyRes, req) {
	if (!isLocalDevHost(req.headers.host)) {
		return;
	}
	const cookies = proxyRes.headers["set-cookie"];
	if (!cookies) {
		return;
	}
	proxyRes.headers["set-cookie"] = cookies.map((cookie) =>
		cookie.replace(/;\s*Domain=[^;]*/gi, ""),
	);
}

export default {
	"^/(app|api|assets|files|private|socket.io)": {
		target: `http://127.0.0.1:${webserver_port}`,
		ws: true,
		changeOrigin: true,
		secure: false,
		router(req) {
			const site_name = resolveSiteName(req.headers.host);
			return `http://${site_name}:${webserver_port}`;
		},
		configure(proxy) {
			proxy.on("proxyReq", (proxyReq, req) => {
				const site_name = resolveSiteName(req.headers.host);
				proxyReq.setHeader("Host", `${site_name}:${webserver_port}`);
			});
			proxy.on("proxyRes", rewriteCookiesForLocalhost);
		},
	},
};

export { default_site, webserver_port };
