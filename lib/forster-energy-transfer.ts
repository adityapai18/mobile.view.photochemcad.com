import { getIntensity, getSpectrumArea, sortAsc, yE } from "./helpers";

export interface ForsterEnergyTransferParams {
  refractiveIndex: number;       // n
  orientationFactor: number;     // κ²
  fluorescenceLifetime: number;  // τ_D in ns
  distance: number;              // r in Å
  donorQuantumYield: number;     // Φ_D
  acceptorEpsilon: number;       // ε(λ*) in M^-1 cm^-1
  wavelengthForEpsilon: number;  // λ* in nm
  lowWavelength: number;         // nm
  highWavelength: number;        // nm
}

export interface ForsterEnergyTransferResults {
  jValue: number;               // "cm(6)/mmol" per original CS UI (C++-style numeric scale)
  forsterDistance: number;      // Å
  transferEfficiency: number;   // %
  rateOfEnergyTransfer: number; // s^-1
  dexterValue: number;          // eV^-1
}



// ---------- Main (direct port of your CS CalculateForsterEnergyTransfer) ----------
export function calculateForsterEnergyTransfer(
  donorEmissionData: SpectrumData[],
  acceptorAbsorptionData: SpectrumData[],
  params: ForsterEnergyTransferParams
): ForsterEnergyTransferResults | null {
  if (donorEmissionData.length < 2 || acceptorAbsorptionData.length < 2) return null;

  // sort ascending (CS ensures ascending inside GetIntensity by sorting if needed)
  const ems = sortAsc(donorEmissionData);
  const abs = sortAsc(acceptorAbsorptionData);

  // Overlap range: use the provided low/high (as in your CS; auto-overlap code is commented there)
  const overlapLow  = params.lowWavelength;
  const overlapHigh = params.highWavelength;
  if (!(overlapHigh > overlapLow)) return null;

  // Areas (CS method calls)
  const fluoArea        = getSpectrumArea(ems, "wavenumber", "ems");
  const absorptionArea  = getSpectrumArea(abs, "wavenumber", "abs");
  if (!(fluoArea > 0) || !(absorptionArea > 0)) return null;

  // ε(λ) anchor
  const epsilon  = params.acceptorEpsilon;
  const lamStar  = params.wavelengthForEpsilon;
  const IstarAbs = getIntensity(abs, lamStar, "abs");
  if (!(epsilon > 0) || !(IstarAbs > 0)) return null;

  let J = 0.0;
  let Dexter = 0.0;

  // Loop over emission segments; include segment only if current point is inside [low, high] (CS behavior)
  for (let m = 1; m < ems.length; m++) {
    const thisPt = ems[m];
    if (thisPt.wavelength < overlapLow || thisPt.wavelength > overlapHigh) continue;

    const prePt = ems[m - 1];

    const v1 = 1e7 / prePt.wavelength;  // cm^-1
    const v2 = 1e7 / thisPt.wavelength; // cm^-1

    const f1 = yE(prePt)  / fluoArea;
    const f2 = yE(thisPt) / fluoArea;

    const deltaX = Math.abs(thisPt.wavelength - prePt.wavelength); // nm

    // absorption intensities at same λ
    const a1 = getIntensity(abs, prePt.wavelength,  "abs");
    const a2 = getIntensity(abs, thisPt.wavelength, "abs");

    // scale to ε(λ) via anchor
    const e1 = epsilon * a1 / IstarAbs;
    const e2 = epsilon * a2 / IstarAbs;

    // CS formula:
    // value  = 1e7 * ( f*ε / ν^4 ) * Δλ / 2
    // value1 = 1e7 * ( f*a/absArea ) * 8066 * Δλ / 2
    const value  = 1e7 * ( f1 * e1 / (v1 ** 4) + f2 * e2 / (v2 ** 4) ) * (deltaX / 2);
    const value1 = 1e7 * ( f1 * a1 / absorptionArea + f2 * a2 / absorptionArea ) * 8066 * (deltaX / 2);

    if (value  > 0) J      += value;
    if (value1 > 0) Dexter += value1;
  }

  // R0^6 (Å^6) — same numeric constants as your CS/C++ line
  const prefactor = 1e25 * 9000 * 2.302585 / (128 * Math.PI ** 5 * 6.0221367);
  const R06 = prefactor * J * params.orientationFactor * params.donorQuantumYield / (params.refractiveIndex ** 4);
  const R0  = R06 > 0 ? Math.pow(R06, 1 / 6) : 0;

  const r  = params.distance; // Å
  const E  = R06 > 0 ? 100 * R06 / (R06 + r ** 6) : 0;
  const kT = (params.fluorescenceLifetime > 0 && r > 0 && R06 > 0)
    ? 1e9 * R06 / (r ** 6 * params.fluorescenceLifetime)
    : 0;

  return {
    jValue: J,
    forsterDistance: R0,
    transferEfficiency: E,
    rateOfEnergyTransfer: kT,
    dexterValue: Dexter
  };
}
