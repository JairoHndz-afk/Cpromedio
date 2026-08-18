const maskCharacters = ["#", "$", "%", "&", "*", "!"];
const looseSeparatorPattern = "[\\s._-]*";
const characterVariants = {
  a: "aáàäâã4@",
  b: "b8",
  c: "cç",
  d: "d",
  e: "eéèëê3",
  g: "g9",
  h: "h",
  i: "iíìïî1!|",
  j: "j",
  k: "k",
  l: "l1|",
  m: "m",
  n: "nñ",
  o: "oóòöôõ0",
  p: "p",
  q: "q",
  r: "r",
  s: "s$5",
  t: "t7",
  u: "uúùüûv",
  v: "vu",
  w: "w",
  x: "x",
  y: "y",
  z: "z2"
};

const profanityDictionary = [
  {
    key: "hijueputa",
    variants: [
      "hijueputa",
      "hijo de puta",
      "jueputa",
      "juepucha",
      "hijuepucha",
      "hijuemadre",
      "hijueperra",
      "hijuepuerca",
      "hpta",
      "hp"
    ]
  },
  {
    key: "gonorrea",
    variants: ["gonorrea", "gonorrea"]
  },
  {
    key: "marica",
    variants: ["marica", "marico", "maricon", "mk", "mka"]
  },
  {
    key: "pirobo",
    variants: ["pirobo", "piroba"]
  },
  {
    key: "malparido",
    variants: ["malparido", "malparida"]
  },
  {
    key: "guevon",
    variants: ["guevon", "guevona", "huevon", "huevona", "webon", "webona", "gvn"]
  },
  {
    key: "carechimba",
    variants: ["carechimba", "carechimbita"]
  },
  {
    key: "caremonda",
    variants: ["caremonda", "careverga", "careculo", "carepicha"]
  },
  {
    key: "monda",
    variants: ["monda"]
  },
  {
    key: "verga",
    variants: ["verga"]
  },
  {
    key: "mierda",
    variants: ["mierda"]
  },
  {
    key: "picha",
    variants: ["picha"]
  },
  {
    key: "culo",
    variants: ["culo"]
  },
  {
    key: "puta",
    variants: ["puta", "puto"]
  }
];

function escapeRegexCharacterClass(value) {
  return String(value ?? "").replace(/[-\\\]^]/g, "\\$&");
}

function escapeRegexLiteral(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildLooseTokenPattern(value) {
  return Array.from(String(value ?? ""))
    .map((character) => {
      if (/\s/u.test(character)) {
        return looseSeparatorPattern;
      }

      const normalized = character
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      const variants = characterVariants[normalized];

      if (variants) {
        return `[${escapeRegexCharacterClass(variants)}]{1,3}`;
      }

      return escapeRegexLiteral(character);
    })
    .join(looseSeparatorPattern);
}

function buildMask(match) {
  let index = 0;

  return Array.from(match)
    .map((character) => {
      if (/\s/u.test(character)) {
        return character;
      }

      const replacement = maskCharacters[index % maskCharacters.length];
      index += 1;
      return replacement;
    })
    .join("");
}

function buildLooseRegex(variants) {
  const body = variants
    .map((variant) => buildLooseTokenPattern(variant))
    .sort((left, right) => right.length - left.length)
    .join("|");

  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${body})(?![\\p{L}\\p{N}])`, "giu");
}

const compiledProfanityMatchers = profanityDictionary.map((entry) => ({
  key: entry.key,
  regex: buildLooseRegex(entry.variants)
}));

export function censorColombianProfanity(value) {
  let nextValue = String(value ?? "");
  const matches = [];

  for (const matcher of compiledProfanityMatchers) {
    matcher.regex.lastIndex = 0;
    nextValue = nextValue.replace(matcher.regex, (match) => {
      matches.push(matcher.key);
      return buildMask(match);
    });
  }

  return {
    value: nextValue,
    matchedTerms: [...new Set(matches)],
    wasCensored: matches.length > 0
  };
}
