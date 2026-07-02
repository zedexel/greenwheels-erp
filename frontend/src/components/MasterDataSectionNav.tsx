import { FileText, MoreVertical } from "lucide-react";

export const MASTER_DATA_SECTIONS = {
	project: "section-project",
	taxi: "section-taxi",
	crusher: "section-crusher",
	customer: "section-customer",
} as const;

export type MasterDataSectionId =
	(typeof MASTER_DATA_SECTIONS)[keyof typeof MASTER_DATA_SECTIONS];

const NAV_ITEMS: { id: MasterDataSectionId; label: string; requiresCrusher?: boolean }[] = [
	{ id: MASTER_DATA_SECTIONS.project, label: "Project" },
	{ id: MASTER_DATA_SECTIONS.taxi, label: "Taxi" },
	{ id: MASTER_DATA_SECTIONS.crusher, label: "Crusher", requiresCrusher: true },
	{ id: MASTER_DATA_SECTIONS.customer, label: "Customer" },
];

interface MasterDataSectionNavProps {
	activeSection: MasterDataSectionId;
	showCrusher: boolean;
	onSelect: (sectionId: MasterDataSectionId) => void;
}

export default function MasterDataSectionNav({
	activeSection,
	showCrusher,
	onSelect,
}: MasterDataSectionNavProps) {
	const items = NAV_ITEMS.filter((item) => !item.requiresCrusher || showCrusher);

	return (
		<nav
			className="hidden w-56 shrink-0 lg:block"
			aria-label="Form sections"
		>
			{/* Sticky wrapper: parent column stretches to full form height via flex */}
			<div className="sticky top-4 space-y-2">
				<p className="mb-3 px-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
					Sections
				</p>
				{items.map((item) => {
					const isActive = activeSection === item.id;
					return (
						<button
							key={item.id}
							type="button"
							className={`flex w-full items-center gap-2 rounded-full px-3 py-2.5 text-left text-sm font-medium transition-colors ${
								isActive
									? "bg-emerald-100 text-emerald-950 shadow-sm"
									: "text-gray-700 hover:bg-emerald-50 hover:text-emerald-900"
							}`}
							onClick={() => onSelect(item.id)}
						>
							<FileText
								className={`h-4 w-4 shrink-0 ${
									isActive ? "text-emerald-800" : "text-gray-500"
								}`}
								aria-hidden
							/>
							<span className="min-w-0 flex-1 truncate">{item.label}</span>
							{isActive && (
								<MoreVertical
									className="h-4 w-4 shrink-0 text-emerald-700"
									aria-hidden
								/>
							)}
						</button>
					);
				})}
			</div>
		</nav>
	);
}
