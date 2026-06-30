export interface MasterFieldConfig {
	name: string;
	label: string;
	type: "text" | "link" | "select" | "checkbox";
	linkDoctype?: string;
	required?: boolean;
	options?: string[];
	defaultValue?: string | number | boolean;
}

export interface MasterEntityConfig {
	key: string;
	doctype: string;
	label: string;
	labelPlural: string;
	listRoute: string;
	createRoute: string;
	listColumns: { key: string; label: string }[];
	fields: MasterFieldConfig[];
	nameField?: string;
}

export const masterEntities: MasterEntityConfig[] = [
	{
		key: "projects",
		doctype: "Project",
		label: "Project",
		labelPlural: "Projects",
		listRoute: "/masters/projects",
		createRoute: "/masters/projects/new",
		nameField: "project_name",
		listColumns: [
			{ key: "name", label: "ID" },
			{ key: "project_name", label: "Project Name" },
			{ key: "company", label: "Company" },
		],
		fields: [
			{ name: "project_name", label: "Project Name", type: "text", required: true },
			{ name: "company", label: "Company", type: "link", linkDoctype: "Company", required: true },
		],
	},
	{
		key: "suppliers",
		doctype: "Supplier",
		label: "Supplier",
		labelPlural: "Suppliers",
		listRoute: "/masters/suppliers",
		createRoute: "/masters/suppliers/new",
		nameField: "supplier_name",
		listColumns: [
			{ key: "name", label: "ID" },
			{ key: "supplier_name", label: "Supplier Name" },
			{ key: "supplier_group", label: "Group" },
		],
		fields: [
			{ name: "supplier_name", label: "Supplier Name", type: "text", required: true },
			{
				name: "supplier_group",
				label: "Supplier Group",
				type: "link",
				linkDoctype: "Supplier Group",
				required: true,
			},
			{
				name: "supplier_type",
				label: "Supplier Type",
				type: "select",
				options: ["Company", "Individual"],
				defaultValue: "Company",
				required: true,
			},
		],
	},
	{
		key: "customers",
		doctype: "Customer",
		label: "Customer",
		labelPlural: "Customers",
		listRoute: "/masters/customers",
		createRoute: "/masters/customers/new",
		nameField: "customer_name",
		listColumns: [
			{ key: "name", label: "ID" },
			{ key: "customer_name", label: "Customer Name" },
			{ key: "customer_group", label: "Group" },
		],
		fields: [
			{ name: "customer_name", label: "Customer Name", type: "text", required: true },
			{
				name: "customer_type",
				label: "Customer Type",
				type: "select",
				options: ["Company", "Individual"],
				defaultValue: "Company",
				required: true,
			},
			{
				name: "customer_group",
				label: "Customer Group",
				type: "link",
				linkDoctype: "Customer Group",
				required: true,
			},
		],
	},
	{
		key: "items",
		doctype: "Item",
		label: "Item",
		labelPlural: "Items",
		listRoute: "/masters/items",
		createRoute: "/masters/items/new",
		nameField: "item_code",
		listColumns: [
			{ key: "name", label: "ID" },
			{ key: "item_name", label: "Item Name" },
			{ key: "item_group", label: "Group" },
		],
		fields: [
			{ name: "item_code", label: "Item Code", type: "text", required: true },
			{ name: "item_name", label: "Item Name", type: "text", required: true },
			{
				name: "item_group",
				label: "Item Group",
				type: "link",
				linkDoctype: "Item Group",
				required: true,
			},
			{
				name: "stock_uom",
				label: "Default UOM",
				type: "link",
				linkDoctype: "UOM",
				required: true,
			},
			{ name: "is_stock_item", label: "Is Stock Item", type: "checkbox", defaultValue: 1 },
			{ name: "is_purchase_item", label: "Allow Purchase", type: "checkbox", defaultValue: 1 },
			{ name: "is_sales_item", label: "Allow Sales", type: "checkbox", defaultValue: 1 },
		],
	},
];

const doctypeToCreatePath: Record<string, string> = {
	Project: "/masters/projects/new",
	Supplier: "/masters/suppliers/new",
	Customer: "/masters/customers/new",
	Item: "/masters/items/new",
};

export function getMasterCreatePath(doctype: string): string | null {
	return doctypeToCreatePath[doctype] || null;
}

export function getMasterConfigByKey(key: string): MasterEntityConfig | undefined {
	return masterEntities.find((entity) => entity.key === key);
}

export function getMasterConfigByDoctype(doctype: string): MasterEntityConfig | undefined {
	return masterEntities.find((entity) => entity.doctype === doctype);
}

export const masterNavItems = masterEntities.map((entity) => ({
	key: entity.key,
	label: entity.labelPlural,
	to: entity.listRoute,
}));
