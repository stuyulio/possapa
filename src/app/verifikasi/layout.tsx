import { KerangkaInternal } from "@/components/dashboard/kerangka";

export default function LayoutVerifikasi({
  children,
}: {
  children: React.ReactNode;
}) {
  // Filter global tidak ditampilkan: antrean punya pemilih periode sendiri.
  return <KerangkaInternal tampilkanFilter={false}>{children}</KerangkaInternal>;
}
