import { KerangkaInternal } from "@/components/dashboard/kerangka";

export default function LayoutLaporanSaya({
  children,
}: {
  children: React.ReactNode;
}) {
  return <KerangkaInternal tampilkanFilter={false}>{children}</KerangkaInternal>;
}
