import type { Especie } from "../api";

const TINTAS = ["#49B6E5", "#F2B866", "#8FD3A5", "#F3A6A0"];

function tintaDe(semilla: string): string {
  let suma = 0;
  for (const letra of semilla) suma += letra.charCodeAt(0);
  return TINTAS[suma % TINTAS.length];
}

const TRAZO = {
  fill: "none",
  stroke: "var(--tinta-linea)",
  strokeWidth: 3,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** La mancha de color queda corrida respecto a la línea, como un dibujo coloreado a mano. */
function Mancha({ d, tinta }: { d: string; tinta: string }) {
  return <path d={d} fill={tinta} transform="translate(7 6)" opacity={0.75} />;
}

function Perro({ tinta }: { tinta: string }) {
  const cuerpo = "M62 118c-10 12-14 28-12 41 18 3 80 4 101-1 2-14-3-30-13-41";
  const cabeza = "M56 62c2-22 22-37 46-36 24 1 43 16 44 39 1 24-17 54-45 54S54 88 56 62z";
  return (
    <>
      <Mancha d={`${cabeza}${cuerpo}z`} tinta={tinta} />
      <path d={cuerpo} {...TRAZO} />
      <path d={cabeza} {...TRAZO} />
      <path d="M61 42C44 34 30 44 29 62c-1 13 7 25 16 25 9 0 13-14 14-27" {...TRAZO} />
      <path d="M141 42c17-9 31 2 33 20 1 13-6 25-15 25s-14-13-15-26" {...TRAZO} />
      <circle cx="84" cy="66" r="4" fill="var(--tinta-linea)" />
      <circle cx="120" cy="65" r="4" fill="var(--tinta-linea)" />
      <path d="M94 80c5-3 11-3 16 0-1 6-5 9-8 9s-7-3-8-9z" fill="var(--tinta-linea)" />
      <path d="M102 89c0 6-1 9-7 11M102 89c1 6 3 9 8 10" {...TRAZO} />
      <path d="M99 101c0 9 8 10 9 0" fill="#F3A6A0" stroke="var(--tinta-linea)" strokeWidth="2.5" />
      <path d="M85 127v30M120 127v30" {...TRAZO} />
    </>
  );
}

function Gato({ tinta }: { tinta: string }) {
  const cuerpo = "M72 116c-14 12-20 28-17 43 16 2 70 3 90-1 4-15-3-31-16-42";
  const cabeza = "M58 34l19 15c15-5 32-5 46 0l20-16c4 17 5 30 3 43-3 25-22 41-46 41S58 101 55 76c-2-13-1-27 3-42z";
  return (
    <>
      <Mancha d={`${cabeza}${cuerpo}z`} tinta={tinta} />
      <path d={cuerpo} {...TRAZO} />
      <path d={cabeza} {...TRAZO} />
      <path d="M144 151c18 2 31-9 29-24-1-10-11-14-17-8" {...TRAZO} />
      <path d="M79 72c3-4 9-4 12 0M110 72c3-4 9-4 12 0" {...TRAZO} />
      <path d="M96 84l5 4 5-4z" fill="var(--tinta-linea)" stroke="var(--tinta-linea)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M101 88c0 5-4 8-9 7M101 88c0 5 4 8 9 7" {...TRAZO} />
      <path d="M72 84l-23-4M72 92l-24 4M130 84l23-5M130 92l24 4" {...TRAZO} strokeWidth={2.2} />
      <path d="M90 124v33M113 124v33" {...TRAZO} />
      <path d="M100 37v9M90 39l2 8M111 39l-2 8" {...TRAZO} strokeWidth={2.2} />
    </>
  );
}

function Conejo({ tinta }: { tinta: string }) {
  const cuerpo = "M71 118c-15 10-22 26-20 41 18 2 75 3 96-1 4-15-3-31-18-41";
  const cabeza = "M60 80c0-20 18-33 41-33s41 13 41 33-19 39-41 39-41-19-41-39z";
  const orejaI = "M81 52C70 34 67 15 74 8c8-7 20 16 21 39";
  const orejaD = "M110 47c5-20 16-40 25-35 9 6 2 27-10 42";
  return (
    <>
      <Mancha d={`${orejaI}${orejaD}${cabeza}${cuerpo}z`} tinta={tinta} />
      <path d={orejaI} {...TRAZO} />
      <path d={orejaD} {...TRAZO} />
      <path d={cuerpo} {...TRAZO} />
      <path d={cabeza} {...TRAZO} />
      <circle cx="84" cy="78" r="4" fill="var(--tinta-linea)" />
      <circle cx="118" cy="78" r="4" fill="var(--tinta-linea)" />
      <path d="M96 89l5 4 5-4z" fill="#F3A6A0" stroke="var(--tinta-linea)" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M101 93v5c-1 4-6 6-10 4M101 98c1 4 6 6 10 4" {...TRAZO} strokeWidth={2.4} />
      <path d="M97 104h8v8h-8z" fill="#fff" stroke="var(--tinta-linea)" strokeWidth="2" />
      <path d="M86 128v28M116 128v28" {...TRAZO} />
    </>
  );
}

export function DoodleMascota({ especie, semilla, className }: { especie: Especie; semilla: string; className?: string }) {
  const tinta = tintaDe(semilla);
  return (
    <svg viewBox="0 0 200 170" className={className} aria-hidden="true" width="200" height="170">
      {especie === "perro" && <Perro tinta={tinta} />}
      {especie === "gato" && <Gato tinta={tinta} />}
      {especie === "conejo" && <Conejo tinta={tinta} />}
    </svg>
  );
}

export function Huella({ className, llena = true }: { className?: string; llena?: boolean }) {
  const relleno = llena ? "currentColor" : "none";
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" width="32" height="32">
      <g fill={relleno} stroke="var(--tinta-linea)" strokeWidth="1.6" strokeLinejoin="round">
        <path d="M16 14.5c4 0 8.4 4.8 7.4 8.8-.8 3-4.3 1.8-7.3 1.9-3 0-6.7 1.2-7.5-1.8-1-4 3.4-8.9 7.4-8.9z" />
        <ellipse cx="6.8" cy="13.4" rx="2.5" ry="3.5" transform="rotate(-18 6.8 13.4)" />
        <ellipse cx="12.4" cy="7.6" rx="2.5" ry="3.8" transform="rotate(-6 12.4 7.6)" />
        <ellipse cx="19.8" cy="7.6" rx="2.5" ry="3.8" transform="rotate(7 19.8 7.6)" />
        <ellipse cx="25.3" cy="13.4" rx="2.5" ry="3.5" transform="rotate(18 25.3 13.4)" />
      </g>
    </svg>
  );
}

export function Subrayado() {
  return (
    <svg className="subrayado" viewBox="0 0 300 16" preserveAspectRatio="none" aria-hidden="true">
      <path d="M4 10c46-7 98-9 146-6 44 2 92 3 146-1-48 5-96 9-136 9" fill="none" stroke="var(--primario)" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}
