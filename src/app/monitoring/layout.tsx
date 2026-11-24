import { KerangkaInternal } from "@/components/dashboard/kerangka";

export default function LayoutMonitoring({
  children,
}: {
  children: React.ReactNode;
}) {
  // Filter global tidak ditampilkan: halaman ini punya pemilih periode sendiri.
  return <KerangkaInternal tampilkanFilter={false}>{children}</KerangkaInternal>;
}
