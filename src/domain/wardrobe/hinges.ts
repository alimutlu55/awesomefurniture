/**
 * Hinges: the one rule for how many hinges a door leaf takes and where they go.
 *
 * THIS IS THE ONLY PLACE THAT COUNTS HINGES. The hardware list and Make ask it.
 */

/** Concealed hinges by a door's height (mm), as common practice advises: up to 900 mm two, to 1600 three, to 2000 four,
 * above five. */
export const hingesFor = (heightMm: number) => heightMm <= 900 ? 2 : heightMm <= 1600 ? 3 : heightMm <= 2000 ? 4 : 5;
/** Hinge centres along a door `length` cm tall: 10 cm from each end and evenly between. */
export function hingeStations(length: number): number[] {
  const n = hingesFor(Math.round(length * 10));
  return Array.from({ length: n }, (_, k) => 10 + (length - 20) * k / (n - 1));
}
