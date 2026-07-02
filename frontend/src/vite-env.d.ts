/// <reference types="vite/client" />

declare const __SITE_NAME__: string;

declare module "*.svg" {
	const src: string;
	export default src;
}

declare module "*.png" {
	const src: string;
	export default src;
}
