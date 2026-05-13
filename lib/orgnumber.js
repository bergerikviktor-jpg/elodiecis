/**
 * Svenskt organisationsnummer — normalisering, validering, formattering.
 *
 * Format: NNNNNN-NNNN (10 siffror, valfri bindestreck efter siffra 6).
 * Den 10:e siffran är en checksumma enligt Luhn-algoritmen ("modulus-10")
 * räknad över de 9 första siffrorna.
 *
 * Luhn-detalj:
 *   - Siffror på udda position (1-indexerat: 1,3,5,7,9) multipliceras med 2.
 *   - Resultat över 9 ersätts med digit-summan (12 → 3, 18 → 9).
 *   - Övriga siffror lämnas orörda.
 *   - Summan av alla bearbetade siffror tas mod 10.
 *   - Kontrollsiffran = (10 - (summa mod 10)) mod 10.
 *
 * Bolagsverket fastställer också att första siffran måste vara 1–9 och att
 * den tredje siffran måste vara ≥ 2 för att skilja juridiska personer från
 * personnummer — vi kontrollerar inte den regeln här, eftersom det i
 * praktiken finns äldre orgnr som inte uppfyller den. Luhn är hård regel.
 */

/**
 * Plocka ut bara siffrorna — strippa alla separatorer och whitespace.
 * Returnerar en sträng (inte number), så ledande nollor bevaras.
 */
export function normalizeOrgNumber(input) {
  if (typeof input !== "string") return "";
  return input.replace(/\D/g, "");
}

/**
 * Sant om strängen är exakt 10 siffror OCH klarar Luhn-checken.
 * Tom sträng / fel längd → false.
 */
export function isValidOrgNumber(input) {
  const digits = normalizeOrgNumber(input);
  if (digits.length !== 10) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let n = Number(digits[i]);
    // Udda position (1-indexerat) → multiplicera med 2.
    if (i % 2 === 0) {
      n *= 2;
      if (n > 9) n -= 9; // ekvivalent med digit-summan för 10..18
    }
    sum += n;
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(digits[9]);
}

/**
 * Format för visning: "NNNNNN-NNNN".
 * Returnerar input oförändrat om det inte går att normalisera till 10 siffror.
 */
export function formatOrgNumber(input) {
  const digits = normalizeOrgNumber(input);
  if (digits.length !== 10) return input || "";
  return `${digits.slice(0, 6)}-${digits.slice(6)}`;
}
