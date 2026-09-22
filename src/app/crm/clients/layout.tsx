/** Soft cache — paired with page `revalidate = 10` and `/api/admin/clients`. */
export const revalidate = 10;

export default function CrmClientsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
