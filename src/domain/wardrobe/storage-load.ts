/**
 * How heavy what is stored is, as the engine's physics reads it (domain/engine/physics): kilograms per square metre of
 * the surface it stands on (folded clothes, shoes, plates), or per metre of rail it hangs from (shirts, coats).
 *
 * These are design loads, not averages: a well-filled shelf or rail, as a person keeps it over years, including hangers
 * and boxes. They come from weighing typical contents over the area they cover (a stack of ten jumpers, about 5 kg on
 * 35 × 30 cm, is 48 kg/m²; with the gaps a shelf keeps, about 30 kg/m²). They are estimates, stated with every result
 * that uses them, and never a manufacturer's rating.
 */
export type StorageLoad = { readonly kgPerM2: number } | { readonly kgPerMetre: number };

/** Kilograms on `areaM2` of surface or `metres` of rail, whichever the load is given in. */
export function storedMass(load: StorageLoad, areaM2: number, metres: number): number {
  return 'kgPerM2' in load ? load.kgPerM2 * areaM2 : load.kgPerMetre * metres;
}
