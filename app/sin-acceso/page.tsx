export default async function SinAcceso({ searchParams }: { searchParams: Promise<{ salida?: string }> }) {
  const salida = (await searchParams).salida === "1";
  return (
    <main className="centro">
      <h1>{salida ? "Has cerrado sesión" : "IVAn"}</h1>
      <p>Para entrar, escribe <code>/panel</code> a IVAn en Telegram y abre el enlace que te mande.</p>
    </main>
  );
}
