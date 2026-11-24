import { KerangkaInternal } from "@/components/dashboard/kerangka";

export default function LayoutPeta({
  children,
}: {
  children: React.ReactNode;
}) {
  // Filter global tidak ditampilkan: halaman ini punya pemilih periode sendiri.
  return <KerangkaInternal tampilkanFilter={false}>{children}</KerangkaInternal>;
}
