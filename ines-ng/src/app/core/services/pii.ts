import { OcrWord } from './ocr.service';

export interface PiiMatch {
  id: number;
  kind: string;
  value: string;
  start: number;
  end: number;
}

export interface PiiTerm {
  value: string;
  label?: string;
  /** Only match when the first character in the text is uppercase (for names/surnames). */
  capitalized?: boolean;
}

export interface PiiDetectOptions {
  /** Enabled category ids (from PII_CATEGORIES). Defaults to all rule categories. */
  kinds?: ReadonlySet<string>;
  /** User-provided terms to look for (e.g. names, specific diagnoses). */
  terms?: PiiTerm[];
}

export interface PiiRule {
  id: string;
  kind: string;
  label: string;
  re: RegExp;
  validate?: (s: string) => boolean;
}

const digits = (s: string) => s.replace(/\D/g, '');

function luhn(s: string): boolean {
  const d = digits(s);
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

function iban(s: string): boolean {
  const c = s.replace(/\s/g, '').toUpperCase();
  if (c.length < 15 || c.length > 34) return false;
  const rearranged = c.slice(4) + c.slice(0, 4);
  let rem = 0;
  for (const ch of rearranged) {
    const v = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
    for (const x of v) rem = (rem * 10 + Number(x)) % 97;
  }
  return rem === 1;
}

function partitaIva(s: string): boolean {
  const d = digits(s).slice(-11);
  if (d.length !== 11) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let n = Number(d[i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return (10 - (sum % 10)) % 10 === Number(d[10]);
}

// L'ordine conta: le regole più specifiche vengono prima, le sovrapposizioni vengono scartate.
export const PII_RULES: PiiRule[] = [
  { id: 'email', kind: 'Email', label: 'Email addresses', re: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g },
  {
    id: 'iban',
    kind: 'IBAN',
    label: 'IBAN',
    re: /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,4})?\b/g,
    validate: iban,
  },
  {
    id: 'tax-code',
    kind: 'Tax code',
    label: 'Tax code (Codice Fiscale)',
    re: /\b[A-Z]{6}\d{2}[A-EHLMPR-T]\d{2}[A-Z]\d{3}[A-Z]\b/gi,
  },
  {
    id: 'card',
    kind: 'Payment card',
    label: 'Payment cards',
    re: /\b(?:\d[ -]?){13,19}\b/g,
    validate: luhn,
  },
  {
    id: 'vat',
    kind: 'VAT number',
    label: 'VAT numbers (Partita IVA)',
    re: /\b(?:IT\s?)?\d{11}\b/g,
    validate: partitaIva,
  },
  {
    id: 'phone',
    kind: 'Phone',
    label: 'Phone numbers',
    re: /(?:(?:\+|00)\d{1,3}[\s.-]?)?\b(?:3\d{2}[\s.-]?\d{6,7}|0\d{1,3}[\s./-]?\d{5,8})\b/g,
  },
  { id: 'ip', kind: 'IP address', label: 'IP addresses', re: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
];

/** Curated list of medical conditions/diagnoses (Italian). Extendable via custom terms. */
export const MEDICAL_TERMS: string[] = [
  'diabete',
  'diabetica',
  'diabetico',
  'tumore',
  'tumori',
  'tumorale',
  'carcinoma',
  'neoplasia',
  'metastasi',
  'melanoma',
  'linfoma',
  'leucemia',
  'cancro',
  'HIV',
  'AIDS',
  'epatite',
  'cirrosi',
  'sclerosi multipla',
  'sclerosi',
  'Alzheimer',
  'Parkinson',
  'demenza',
  'depressione',
  'ansia',
  'disturbo bipolare',
  'schizofrenia',
  'psicosi',
  'infarto',
  'ictus',
  'ischemia',
  'aneurisma',
  'trombosi',
  'embolia',
  'ipertensione',
  'ipotensione',
  'aritmia',
  'fibrillazione',
  'anemia',
  'talassemia',
  'emofilia',
  'epilessia',
  'asma',
  'bronchite cronica',
  'BPCO',
  'enfisema',
  'artrite',
  'artrosi',
  'osteoporosi',
  'fibromialgia',
  'lupus',
  'celiachia',
  'morbo di Crohn',
  'colite ulcerosa',
  'psoriasi',
  'dermatite atopica',
  'ulcera',
  'gastrite',
  'insufficienza renale',
  'dialisi',
  'tubercolosi',
  'polmonite',
  'bronchite',
  'autismo',
  'ADHD',
  'dislessia',
  'alcolismo',
  'tossicodipendenza',
  'anoressia',
  'bulimia',
  'glaucoma',
  'cataratta',
  'maculopatia',
  'infertilità',
  'infertilita',
  'trapianto',
  'protesi',
  'pacemaker',
  'chemioterapia',
  'radioterapia',
  'cure palliative',
  'hospice',
];

export const ITALIAN_FIRST_NAMES: string[] = [
  'Achille',
  'Adriano',
  'Agostino',
  'Alberto',
  'Aldo',
  'Alessandro',
  'Alessio',
  'Alfredo',
  'Amedeo',
  'Andrea',
  'Angelo',
  'Antonello',
  'Antonio',
  'Armando',
  'Arturo',
  'Augusto',
  'Aurelio',
  'Benedetto',
  'Beniamino',
  'Bernardo',
  'Biagio',
  'Bruno',
  'Carlo',
  'Carmelo',
  'Carmine',
  'Cesare',
  'Christian',
  'Ciro',
  'Claudio',
  'Clemente',
  'Corrado',
  'Cosimo',
  'Cristian',
  'Daniele',
  'Danilo',
  'Dario',
  'Davide',
  'Diego',
  'Domenico',
  'Donato',
  'Edoardo',
  'Elia',
  'Elio',
  'Emanuele',
  'Emilio',
  'Enrico',
  'Enzo',
  'Ettore',
  'Eugenio',
  'Fabio',
  'Fabrizio',
  'Fausto',
  'Federico',
  'Felice',
  'Ferdinando',
  'Filippo',
  'Flavio',
  'Francesco',
  'Franco',
  'Gabriele',
  'Gaetano',
  'Gennaro',
  'Gerardo',
  'Giacomo',
  'Giancarlo',
  'Gianfranco',
  'Gianluca',
  'Gianni',
  'Giorgio',
  'Giovanni',
  'Giuliano',
  'Giulio',
  'Giuseppe',
  'Guido',
  'Ignazio',
  'Jacopo',
  'Leonardo',
  'Lorenzo',
  'Luca',
  'Luciano',
  'Luigi',
  'Marcello',
  'Marco',
  'Mariano',
  'Mario',
  'Massimiliano',
  'Massimo',
  'Matteo',
  'Mattia',
  'Maurizio',
  'Mauro',
  'Michele',
  'Mirko',
  'Nicola',
  'Nunzio',
  'Orazio',
  'Oreste',
  'Orlando',
  'Oscar',
  'Paolo',
  'Pasquale',
  'Patrizio',
  'Piero',
  'Pietro',
  'Raffaele',
  'Raimondo',
  'Renato',
  'Renzo',
  'Riccardo',
  'Rocco',
  'Romeo',
  'Rosario',
  'Ruggero',
  'Salvatore',
  'Samuele',
  'Sandro',
  'Saverio',
  'Sebastiano',
  'Sergio',
  'Silvano',
  'Silvio',
  'Simone',
  'Stefano',
  'Teodoro',
  'Tiziano',
  'Tommaso',
  'Ugo',
  'Umberto',
  'Valentino',
  'Valerio',
  'Vincenzo',
  'Vito',
  'Vittorio',
  'Walter',
  'Ada',
  'Adele',
  'Adriana',
  'Agata',
  'Agnese',
  'Alba',
  'Alessandra',
  'Alessia',
  'Alice',
  'Amalia',
  'Ambra',
  'Amelia',
  'Angela',
  'Angelica',
  'Anita',
  'Anna',
  'Annamaria',
  'Antonella',
  'Antonia',
  'Antonietta',
  'Assunta',
  'Aurora',
  'Barbara',
  'Beatrice',
  'Benedetta',
  'Bianca',
  'Bruna',
  'Camilla',
  'Carla',
  'Carlotta',
  'Carmela',
  'Carolina',
  'Caterina',
  'Cecilia',
  'Celeste',
  'Chiara',
  'Cinzia',
  'Clara',
  'Claudia',
  'Clelia',
  'Concetta',
  'Cristina',
  'Daria',
  'Debora',
  'Diletta',
  'Domenica',
  'Donatella',
  'Elena',
  'Eleonora',
  'Elisa',
  'Elisabetta',
  'Elvira',
  'Emanuela',
  'Emilia',
  'Emma',
  'Enrica',
  'Erika',
  'Ester',
  'Fabiola',
  'Federica',
  'Fernanda',
  'Filomena',
  'Fiorella',
  'Flavia',
  'Francesca',
  'Franca',
  'Gabriella',
  'Gaia',
  'Gemma',
  'Giada',
  'Gianna',
  'Gilda',
  'Giorgia',
  'Giovanna',
  'Giuditta',
  'Giulia',
  'Giuliana',
  'Giuseppina',
  'Grazia',
  'Graziella',
  'Greta',
  'Ida',
  'Ilaria',
  'Iolanda',
  'Irene',
  'Isabella',
  'Ivana',
  'Lara',
  'Laura',
  'Lavinia',
  'Letizia',
  'Lia',
  'Lidia',
  'Liliana',
  'Lina',
  'Lisa',
  'Loredana',
  'Lorena',
  'Loretta',
  'Luana',
  'Lucia',
  'Luciana',
  'Lucrezia',
  'Ludovica',
  'Luisa',
  'Maddalena',
  'Manuela',
  'Mara',
  'Marcella',
  'Margherita',
  'Maria',
  'Marianna',
  'Mariella',
  'Marilena',
  'Marina',
  'Marisa',
  'Marta',
  'Martina',
  'Matilde',
  'Michela',
  'Milena',
  'Mirella',
  'Miriam',
  'Monica',
  'Nadia',
  'Natalia',
  'Nicoletta',
  'Nina',
  'Noemi',
  'Nora',
  'Olga',
  'Ornella',
  'Paola',
  'Patrizia',
  'Piera',
  'Rachele',
  'Rebecca',
  'Renata',
  'Rita',
  'Roberta',
  'Romina',
  'Rosa',
  'Rosalba',
  'Rosanna',
  'Rosaria',
  'Rossella',
  'Sabina',
  'Sabrina',
  'Sandra',
  'Sara',
  'Serena',
  'Silvana',
  'Silvia',
  'Simona',
  'Sofia',
  'Sonia',
  'Stefania',
  'Stella',
  'Susanna',
  'Teresa',
  'Tina',
  'Tiziana',
  'Valeria',
  'Vanessa',
  'Vera',
  'Veronica',
  'Vilma',
  'Vincenza',
  'Viola',
  'Virginia',
  'Vittoria',
  'Wanda',
];

/** Most common Italian surnames (case-insensitive match, only when capitalized in text). */
export const ITALIAN_SURNAMES: string[] = [
  'Amato',
  'Barbieri',
  'Barone',
  'Basile',
  'Bellini',
  'Benedetti',
  'Bernardi',
  'Bianchi',
  'Bianco',
  'Bruno',
  'Carbone',
  'Caruso',
  'Catalano',
  'Cattaneo',
  'Colombo',
  'Conte',
  'Conti',
  'Coppola',
  'Costa',
  "D'Amico",
  "D'Angelo",
  'De Angelis',
  'De Luca',
  'De Rosa',
  'De Santis',
  'De Simone',
  'Donati',
  'Esposito',
  'Fabbri',
  'Farina',
  'Ferrara',
  'Ferrari',
  'Ferretti',
  'Ferri',
  'Ferro',
  'Fiore',
  'Fontana',
  'Galli',
  'Gallo',
  'Gatti',
  'Gentile',
  'Giordano',
  'Giusti',
  'Grassi',
  'Greco',
  'Guerra',
  'Leone',
  'Lombardi',
  'Lombardo',
  'Longo',
  'Mancini',
  'Marchetti',
  'Mariani',
  'Marini',
  'Marino',
  'Martini',
  'Martinelli',
  'Mele',
  'Messina',
  'Milani',
  'Montanari',
  'Monti',
  'Morelli',
  'Moretti',
  'Negri',
  'Orlandi',
  'Pagano',
  'Palumbo',
  'Palmieri',
  'Parisi',
  'Pellegrini',
  'Pellegrino',
  'Piras',
  'Proietti',
  'Ricci',
  'Rinaldi',
  'Riva',
  'Rizzi',
  'Rizzo',
  'Romano',
  'Romeo',
  'Rossetti',
  'Rossi',
  'Ruggiero',
  'Russo',
  'Sala',
  'Sanna',
  'Santoro',
  'Sartori',
  'Serra',
  'Silvestri',
  'Sorrentino',
  'Testa',
  'Valentini',
  'Villa',
  'Vitale',
  'Vitali',
];

export const PII_CATEGORIES: { id: string; label: string }[] = [
  ...PII_RULES.map((r) => ({ id: r.id, label: r.label })),
  { id: 'names', label: 'First names (Italian)' },
  { id: 'surnames', label: 'Surnames (Italian)' },
  { id: 'medical', label: 'Medical terms & diagnoses' },
];

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Case-insensitive, whole-word/phrase matcher. */
const termRegex = (term: string) => new RegExp(`\\b${escapeRegex(term.trim())}\\b`, 'gi');

export function detectPii(text: string, options: PiiDetectOptions = {}): PiiMatch[] {
  const enabledKinds = options.kinds ?? new Set(PII_RULES.map((r) => r.id));
  const rules = PII_RULES.filter((r) => enabledKinds.has(r.id));
  const found: PiiMatch[] = [];

  const push = (kind: string, value: string, start: number, end: number) => {
    if (found.some((f) => start < f.end && end > f.start)) return;
    found.push({ id: found.length, kind, value, start, end });
  };

  for (const rule of rules) {
    for (const m of text.matchAll(rule.re)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (rule.validate && !rule.validate(m[0])) continue;
      push(rule.kind, m[0], start, end);
    }
  }

  // Longer terms first so multi-word phrases win over their sub-words.
  const terms: PiiTerm[] = [];
  if (enabledKinds.has('medical'))
    terms.push(...MEDICAL_TERMS.map((t) => ({ value: t, label: 'Medical' })));
  if (enabledKinds.has('names'))
    terms.push(...ITALIAN_FIRST_NAMES.map((t) => ({ value: t, label: 'Name', capitalized: true })));
  if (enabledKinds.has('surnames'))
    terms.push(...ITALIAN_SURNAMES.map((t) => ({ value: t, label: 'Surname', capitalized: true })));
  terms.push(...(options.terms ?? []));
  terms.sort((a, b) => b.value.length - a.value.length);

  for (const term of terms) {
    const t = term.value.trim();
    if (!t) continue;
    for (const m of text.matchAll(termRegex(t))) {
      if (term.capitalized && !/^[A-ZÀÈÌÒÙ]/.test(m[0])) continue;
      const start = m.index ?? 0;
      push(term.label ?? 'Custom', m[0], start, start + m[0].length);
    }
  }

  return found.sort((a, b) => a.start - b.start).map((f, i) => ({ ...f, id: i }));
}

/** Unisce le parole OCR in un testo unico e ricorda dove inizia ciascuna parola. */
export function joinWords(words: OcrWord[]): {
  text: string;
  spans: { start: number; end: number }[];
} {
  let text = '';
  const spans = words.map((w) => {
    if (text) text += ' ';
    const start = text.length;
    text += w.text;
    return { start, end: text.length };
  });
  return { text, spans };
}

export function wordsForMatch(spans: { start: number; end: number }[], m: PiiMatch): number[] {
  const idx: number[] = [];
  spans.forEach((s, i) => {
    if (s.start < m.end && s.end > m.start) idx.push(i);
  });
  return idx;
}
