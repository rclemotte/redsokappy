import { Decoracion } from "@/components/ui";
import { Logo } from "@/components/Shell";

// Pantallas de ingreso: arriba el arte con degradé, abajo la tarjeta con el formulario.
export default function AuthMarco({ titulo, texto, children }: { titulo: string; texto?: string; children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen flex-col bg-sol lg:items-center lg:justify-center">
      <Decoracion className="fixed" />
      <div className="relative flex flex-1 flex-col justify-end px-6 pb-8 pt-[calc(env(safe-area-inset-top)+3rem)] text-white lg:flex-none lg:pb-6 lg:text-center">
        <div className="lg:flex lg:justify-center"><Logo claro /></div>
        <h1 className="mt-6 font-display text-[2.4rem] font-extrabold leading-[1.02] drop-shadow-sm">{titulo}</h1>
        {texto && <p className="mt-2 max-w-sm text-[16px] font-semibold text-white/90 lg:mx-auto">{texto}</p>}
      </div>
      <div className="relative rounded-t-[2.25rem] bg-white px-6 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-7 shadow-flotante lg:w-full lg:max-w-md lg:rounded-4xl lg:pb-8">
        {children}
      </div>
    </main>
  );
}
