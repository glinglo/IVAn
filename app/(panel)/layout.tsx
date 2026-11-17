import { exigirSesion } from "@/lib/auth";
import { Nav } from "@/components/Nav";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await exigirSesion();
  return (
    <>
      <main className="app">{children}</main>
      <Nav />
    </>
  );
}
