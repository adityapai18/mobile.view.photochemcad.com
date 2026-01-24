import { emissionAreas_nu, sortAsc, yA, yE } from "./helpers";

// ---------- Types ----------
export interface NaturalRadiativeLifetimeParams {
  lowWavelength: number;         // nm (0~10000)
  highWavelength: number;        // nm (0~10000)
  refractiveIndex: number;       // n
  epsilon: number;               // M⁻¹cm⁻¹
  wavelengthForEpsilon: number;  // nm
  quantumYield: number;          // Φf (0~1)
}

export interface NaturalRadiativeLifetimeResults {
  integralTerm: number;          // ∫εdln(ν)
  meanValue: number;             // <ν⁻³>⁻¹
  naturalRadiativeLifetime: number; // τ₀ (ns)
  transitionRate: number;        // k_f (s⁻¹)
  actualFluorescenceLifetime: number; // τ (ns)
}

// ---------- Main calculation function ----------
// ---------- Main calculation function ----------
export function calculateNaturalRadiativeLifetime(
  emissionData: SpectrumData[],
  absorptionData: SpectrumData[],
  params: NaturalRadiativeLifetimeParams
): NaturalRadiativeLifetimeResults | null {
  if (emissionData.length < 2 || absorptionData.length < 2) return null;

  const { lowWavelength: low, highWavelength: high, refractiveIndex: n,
          epsilon, wavelengthForEpsilon: lambdaStar, quantumYield: phiF } = params;

  if (!(high > low) || n < 1 || epsilon <= 0 || lambdaStar <= 0 || phiF < 0 || phiF > 1) {
    return null;
  }

  // Linear interpolation over sorted (λ, y). Clamp out-of-range to 0 (like your CS GetIntensity).
  function interpY(sorted: SpectrumData[], wave: number, kind: "ems" | "abs"): number {
    const getY = kind === "ems" ? yE : yA;
    const n = sorted.length;
    if (n === 0) return 0;
    if (n === 1) return getY(sorted[0]);

    const first = sorted[0].wavelength, last = sorted[n - 1].wavelength;
    if (wave < first || wave > last) return 0;
    if (wave === first) return getY(sorted[0]);
    if (wave === last)  return getY(sorted[n - 1]);

    // binary search for bracketing pair
    let lo = 0, hi = n - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const xm = sorted[mid].wavelength;
      if (xm === wave) return getY(sorted[mid]);
      if (xm > wave) hi = mid - 1; else lo = mid + 1;
    }
    const M = sorted[hi], N = sorted[lo];
    return getY(M) + (getY(N) - getY(M)) * (wave - M.wavelength) / (N.wavelength - M.wavelength);
  }


  // ---- prep sorted data ----
  const ems = sortAsc(emissionData);
  const abs = sortAsc(absorptionData);

  // ---- emission normalizations (whole arrays, like CS) ----
  const { fluoArea, fluoV3 } = emissionAreas_nu(ems);
  if (!(fluoArea > 0) || !(fluoV3 > 0)) return null;

  // <ν^-3>^{-1} = fluoArea / fluoV3  (C#: reciprocalV3)
  const meanV3_recip = fluoArea / fluoV3;

  // ---- absorption scaling to ε(λ) via anchor (λ*, ε*) ----
  const Astar = interpY(abs, lambdaStar, "abs");
  if (!(Astar > 0)) return null; // need valid anchor point
  const epsScale = epsilon / Astar;

  // ---- integral term: ∫ ε d ln ν ≈ Σ (ε1/ν1 + ε2/ν2) * Δν / 2
  // Follow CS loop: run over absorption segments; include only if current point λ is inside [low, high]
  let eps_dlnv = 0;
  let maxEps   = 0;

  for (let i = 1; i < abs.length; i++) {
    const pPrev = abs[i - 1], pCur = abs[i];
    const λ2 = pCur.wavelength;
    if (λ2 < low || λ2 > high) continue;

    const λ1 = pPrev.wavelength;
    const v1 = 1e7 / λ1; // cm^-1
    const v2 = 1e7 / λ2; // cm^-1
    const dν = Math.abs(v1 - v2);

    // ε(λ) via anchor
    const ε1 = epsScale * yA(pPrev);
    const ε2 = epsScale * yA(pCur);

    maxEps = Math.max(maxEps, ε1, ε2);

    eps_dlnv += (ε1 / v1 + ε2 / v2) * dν / 2;
  }

  // ---- Strickler–Berg rate and times (C# constants) ----
  const n2 = n * n;
  const kf = 2.880e-9 * n2 * meanV3_recip * eps_dlnv; // s^-1
  if (!(kf > 0)) return null;

  const tau0_ns = 1e9 / kf;     // natural radiative lifetime (ns)
  const tau_ns  = phiF * tau0_ns; // actual fluorescence lifetime (ns)

  return {
    integralTerm: eps_dlnv,
    meanValue: meanV3_recip,
    naturalRadiativeLifetime: tau0_ns,
    transitionRate: kf,
    actualFluorescenceLifetime: tau_ns
  };
}

