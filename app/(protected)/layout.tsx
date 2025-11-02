export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <section>{children}</section>;
}
