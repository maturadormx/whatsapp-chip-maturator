export interface PersonaDraft {
  displayName: string;
  homeState: string;
  homeCity: string;
  primaryDDD: string;
  secondaryDDDs: string[];
  profession: string;
  ageRange: string;
  socialProfile: string;
  wakeHour: number;
  sleepHour: number;
  weekendProfile: string;
  interests: string[];
}

const PERSONA_REGIONS = [
  { state: "MG", city: "Belo Horizonte", primaryDDD: "31", secondaryDDDs: ["32", "33"] },
  { state: "SP", city: "Campinas", primaryDDD: "19", secondaryDDDs: ["11", "15"] },
  { state: "SP", city: "São Paulo", primaryDDD: "11", secondaryDDDs: ["12", "13"] },
  { state: "RJ", city: "Rio de Janeiro", primaryDDD: "21", secondaryDDDs: ["22", "24"] },
  { state: "PR", city: "Curitiba", primaryDDD: "41", secondaryDDDs: ["42", "43"] },
  { state: "SC", city: "Florianópolis", primaryDDD: "48", secondaryDDDs: ["47", "49"] },
  { state: "BA", city: "Salvador", primaryDDD: "71", secondaryDDDs: ["73", "75"] },
  { state: "PE", city: "Recife", primaryDDD: "81", secondaryDDDs: ["87", "71"] },
  { state: "GO", city: "Goiânia", primaryDDD: "62", secondaryDDDs: ["64", "61"] },
  { state: "CE", city: "Fortaleza", primaryDDD: "85", secondaryDDDs: ["88", "81"] },
] as const;

const DISPLAY_NAMES = [
  "Ana Clara",
  "Bruna",
  "Camila",
  "Daniel",
  "Eduardo",
  "Felipe",
  "Gabriel",
  "Isabela",
  "Larissa",
  "Lucas",
  "Marina",
  "Matheus",
  "Natália",
  "Rafael",
  "Renata",
  "Thiago",
] as const;

const PROFESSIONS = [
  "Analista comercial",
  "Assistente administrativo",
  "Consultor de campo",
  "Designer freelancer",
  "Gestor de tráfego",
  "Representante comercial",
  "Social media",
  "Técnico de suporte",
  "Vendedor externo",
  "Supervisor operacional",
] as const;

const AGE_RANGES = ["22-27", "28-34", "35-42"] as const;
const SOCIAL_PROFILES = ["discreto", "equilibrado", "sociável", "observador"] as const;
const WEEKEND_PROFILES = ["caseiro", "social", "família", "misturado"] as const;

const INTEREST_POOLS = [
  "café",
  "corrida",
  "futebol",
  "tecnologia",
  "empreendedorismo",
  "séries",
  "gastronomia",
  "praia",
  "viagens curtas",
  "música",
  "academia",
  "fotografia",
] as const;

function pickOne<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function pickMany<T>(items: readonly T[], count: number) {
  const pool = [...items];
  const picked: T[] = [];
  while (pool.length > 0 && picked.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
}

function inferPreferredDDD(phoneNumber?: string | null) {
  const digits = String(phoneNumber ?? "").replace(/\D/g, "");
  if (digits.length >= 12 && digits.startsWith("55")) {
    return digits.slice(2, 4);
  }
  if (digits.length >= 10) {
    return digits.slice(0, 2);
  }
  return null;
}

export function generateRandomPersonaDraft(input?: {
  chipId?: number;
  chipName?: string;
  phoneNumber?: string | null;
}): PersonaDraft {
  const preferredDDD = inferPreferredDDD(input?.phoneNumber);
  const region =
    PERSONA_REGIONS.find(
      (item) =>
        item.primaryDDD === preferredDDD ||
        item.secondaryDDDs.some((ddd) => ddd === String(preferredDDD))
    ) ??
    pickOne(PERSONA_REGIONS);

  const wakeHour = 6 + Math.floor(Math.random() * 4);
  const sleepHour = 21 + Math.floor(Math.random() * 3);

  return {
    displayName: pickOne(DISPLAY_NAMES),
    homeState: region.state,
    homeCity: region.city,
    primaryDDD: region.primaryDDD,
    secondaryDDDs: region.secondaryDDDs.slice(0, 2),
    profession: pickOne(PROFESSIONS),
    ageRange: pickOne(AGE_RANGES),
    socialProfile: pickOne(SOCIAL_PROFILES),
    wakeHour,
    sleepHour: Math.max(wakeHour + 10, sleepHour),
    weekendProfile: pickOne(WEEKEND_PROFILES),
    interests: pickMany(INTEREST_POOLS, 3),
  };
}

export function buildPersonaAbout(persona: PersonaDraft) {
  const interests = persona.interests.slice(0, 2).join(", ");
  return `${persona.profession} em ${persona.homeCity}. Perfil ${persona.socialProfile}; curte ${interests}.`;
}
