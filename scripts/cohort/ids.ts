// Australian healthcare identifiers (synthetic) and their check digits.

/** Luhn check over a string of digits. */
export function luhnValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

function luhnCheckDigit(body: string): string {
  for (let d = 0; d <= 9; d++) if (luhnValid(body + d)) return String(d);
  throw new Error("unreachable");
}

/** 9 digits taken from a seeded random source. */
type Rand = () => number;
const digits = (rand: Rand, n: number) => Array.from({ length: n }, () => Math.floor(rand() * 10)).join("");

// 16-digit national identifiers: 800360 = individual (IHI), 800361 = provider (HPI-I), 800362 = organisation (HPI-O).
const hi = (prefix: string) => (rand: Rand) => {
  const body = prefix + digits(rand, 9);
  return body + luhnCheckDigit(body);
};
export const makeIhi = hi("800360");
export const makeHpii = hi("800361");
export const makeHpio = hi("800362");

export const isIhi = (v: string) => /^800360\d{10}$/.test(v) && luhnValid(v);

const MEDICARE_WEIGHTS = [1, 3, 7, 9, 1, 3, 7, 9];
const medicareCheck = (first8: string) =>
  String([...first8].reduce((sum, d, i) => sum + Number(d) * MEDICARE_WEIGHTS[i], 0) % 10);

/** 10-digit Medicare card number: 8 digits (first is 2–6), check digit, issue number. */
export function makeMedicare(rand: Rand): string {
  const first8 = String(2 + Math.floor(rand() * 5)) + digits(rand, 7);
  return first8 + medicareCheck(first8) + String(1 + Math.floor(rand() * 9));
}

export const isMedicare = (v: string) =>
  /^[2-6]\d{9}$/.test(v) && medicareCheck(v.slice(0, 8)) === v[8] && v[9] !== "0";
