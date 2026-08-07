import "dotenv/config";
import { prisma } from "./db";

type TurnoSeed = { tipo: "manana" | "tarde"; horario: string; patronbaseProdId: string };
type PlantaSeed = { nombre: string; reglasEspeciales?: string; turnos: TurnoSeed[] };
type BibliotecaSeed = {
  nombre: string;
  patronbaseCodigo: string;
  reglasEspeciales?: string;
  plantas: PlantaSeed[];
};

// Datos extraídos de analisis-sistema-reservas-biblioteca-ceuta.md y verificados en vivo
// contra /_BibliotecaCeuta/Productions (los 12 patronbaseProdId son los códigos reales
// devueltos por el sitio). libraries.service.ts vuelve a sincronizar estos IDs contra la
// web en cada consulta de disponibilidad, por si PatronBase los cambia con el tiempo.
const bibliotecas: BibliotecaSeed[] = [
  {
    nombre: 'BP "Adolfo Suárez"',
    patronbaseCodigo: "BPC",
    reglasEspeciales: JSON.stringify({ sinReservaSabadoTarde: true, sinReservaDomingo: true }),
    plantas: [
      {
        nombre: "3ª Planta",
        turnos: [
          { tipo: "manana", horario: "L-V 09:00-15:00, S 09:00-14:00", patronbaseProdId: "KK" },
          { tipo: "tarde", horario: "L-V 15:00-cierre", patronbaseProdId: "KL" },
        ],
      },
      {
        nombre: "4ª Planta",
        turnos: [
          { tipo: "manana", horario: "L-V 09:00-15:00, S 09:00-14:00", patronbaseProdId: "KM" },
          { tipo: "tarde", horario: "L-V 15:00-cierre", patronbaseProdId: "KN" },
        ],
      },
      {
        nombre: "5ª Planta",
        reglasEspeciales: JSON.stringify({ cerradaSabadoManana: true }),
        turnos: [
          { tipo: "manana", horario: "L-V 09:00-15:00", patronbaseProdId: "KJ" },
          { tipo: "tarde", horario: "L-V 15:00-cierre", patronbaseProdId: "KO" },
        ],
      },
    ],
  },
  {
    nombre: 'BP "El Morro"',
    patronbaseCodigo: "BBC",
    plantas: [
      {
        nombre: "Planta 0",
        turnos: [
          { tipo: "manana", horario: "L-V 09:00-15:00, S 09:00-14:00", patronbaseProdId: "KC" },
          { tipo: "tarde", horario: "L-V 15:00-21:00", patronbaseProdId: "KD" },
        ],
      },
      {
        nombre: "Planta 1ª",
        turnos: [
          { tipo: "manana", horario: "L-V 09:00-15:00, S 09:00-14:00", patronbaseProdId: "KE" },
          { tipo: "tarde", horario: "L-V 15:00-21:00", patronbaseProdId: "KF" },
        ],
      },
    ],
  },
  {
    nombre: 'BP "Estación del Ferrocarril"',
    patronbaseCodigo: "EF",
    plantas: [
      {
        nombre: "Sala única",
        turnos: [
          { tipo: "manana", horario: "L-V 09:00-15:00, S 09:00-14:00", patronbaseProdId: "KG" },
          { tipo: "tarde", horario: "L-V 15:00-21:00", patronbaseProdId: "KH" },
        ],
      },
    ],
  },
];

async function main() {
  for (const b of bibliotecas) {
    const biblioteca = await prisma.biblioteca.upsert({
      where: { nombre: b.nombre },
      update: { patronbaseCodigo: b.patronbaseCodigo, reglasEspeciales: b.reglasEspeciales },
      create: {
        nombre: b.nombre,
        patronbaseCodigo: b.patronbaseCodigo,
        reglasEspeciales: b.reglasEspeciales,
      },
    });

    for (const p of b.plantas) {
      const existente = await prisma.planta.findFirst({
        where: { bibliotecaId: biblioteca.id, nombre: p.nombre },
      });
      const planta = existente
        ? await prisma.planta.update({
            where: { id: existente.id },
            data: { reglasEspeciales: p.reglasEspeciales },
          })
        : await prisma.planta.create({
            data: {
              bibliotecaId: biblioteca.id,
              nombre: p.nombre,
              reglasEspeciales: p.reglasEspeciales,
            },
          });

      for (const t of p.turnos) {
        const existenteTurno = await prisma.turno.findFirst({
          where: { plantaId: planta.id, tipo: t.tipo },
        });
        if (existenteTurno) {
          await prisma.turno.update({
            where: { id: existenteTurno.id },
            data: { horario: t.horario, patronbaseProdId: t.patronbaseProdId },
          });
        } else {
          await prisma.turno.create({
            data: {
              plantaId: planta.id,
              tipo: t.tipo,
              horario: t.horario,
              patronbaseProdId: t.patronbaseProdId,
            },
          });
        }
      }
    }
  }

  console.log("Seed completado: bibliotecas, plantas y turnos cargados.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
