export default async function SinAcceso({ searchParams }: { searchParams: Promise<{ salida?: string }> }) {
  const salida = (await searchParams).salida === "1";
  return (
    <main className="max-w-sm mx-auto mt-[20vh] px-6 text-center leading-relaxed">
      <h1 className="text-title">{salida ? "Has cerrado sesión" : "IVAn"}</h1>
      <p className="text-body mt-2">
        Para entrar, escribe{" "}
        <code className="bg-gray-100 rounded-md px-1.5 py-0.5">/panel</code> a IVAn en Telegram y abre el enlace
        que te mande.
      </p>
    </main>
  );
}
