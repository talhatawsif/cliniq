// Australian healthcare identifiers for the synthetic cohort.
//
// Identifiers are NOT generated: a random number with a valid check digit can equal a real
// person's identifier. They are taken from the values Services Australia reserves for testing,
// as published in HL7 Australia's test data (see test-identifiers.json).
// There is no reserved test range for Medicare card numbers, so the cohort carries none.
import pool from "./test-identifiers.json" with { type: "json" };

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

// 16 digits: 800360 = individual (IHI), 800361 = provider (HPI-I), 800362 = organisation (HPI-O).
export const isIhi = (v: string) => /^800360\d{10}$/.test(v) && luhnValid(v);

function take(list: string[], kind: string) {
  return (index: number) => {
    if (index >= list.length) throw new Error(`Only ${list.length} test ${kind} values are available`);
    return list[index];
  };
}

/** The nth reserved test identifier of each kind. */
export const testIhi = take(pool.ihi, "IHI");
export const testHpii = take(pool.hpii, "HPI-I");
export const testHpio = take(pool.hpio, "HPI-O");
export const TEST_IDENTIFIERS = pool;
