import { KerangkaInternal } from "@/components/dashboard/kerangka";

export default function LayoutInput({
  children,
}: {
  children: React.ReactNode;
}) {
  return <KerangkaInternal tampilkanFilter={false}>{children}</KerangkaInternal>;
}
