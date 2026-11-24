import { KerangkaInternal } from "@/components/dashboard/kerangka";

export default function LayoutDashboard({
  children,
}: {
  children: React.ReactNode;
}) {
  return <KerangkaInternal>{children}</KerangkaInternal>;
}
