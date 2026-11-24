import { KerangkaInternal } from "@/components/dashboard/kerangka";

export default function LayoutLokasiSaya({
  children,
}: {
  children: React.ReactNode;
}) {
  return <KerangkaInternal tampilkanFilter={false}>{children}</KerangkaInternal>;
}
