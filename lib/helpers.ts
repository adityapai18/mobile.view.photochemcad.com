export function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}


// ---------- Mathematical Helpers ----------

// sort by wavelength ascending
export function sortAsc<T extends SpectrumData>(arr: T[]): T[] {
  return [...arr].sort((a, b) => a.wavelength - b.wavelength);
}

export function yE(p: SpectrumData): number { return p.normalized ?? 0; }  // emission
export function yA(p: SpectrumData): number { return p.coefficient ?? 0; } // absorption

// Get normalized intensity (0-1 range) using the same interpolation logic
export function getNormalizedIntensity(sorted: SpectrumData[], wave: number, kind: "ems" | "abs" = 'abs'): number {
  return getIntensity(sorted, wave, kind, true);
}

// Linear interpolation on sorted (λ_nm, y); clamps to ends. Returns 0 if out-of-range (like CS).
export function getIntensity(sorted: SpectrumData[], wave: number, kind: "ems" | "abs" = 'abs', normalize: boolean = false): number {
  const getY = kind === "ems" ? yE : yA;
  const n = sorted.length;
  if (n === 0) return 0;
  if (n === 1) return getY(sorted[0]);

  // If normalization is requested, normalize all y values first
  let normalizedData: { wavelength: number; normalizedY: number }[] = [];
  
  if (normalize) {
    // Get all y values and find min/max for normalization
    const values = sorted.map(point => getY(point)).filter(v => v !== null && v !== undefined);
    if (values.length > 0) {
      const min = Math.min(...values);
      const max = Math.max(...values);
      
      if (max !== min) {
        // Create normalized data array
        normalizedData = sorted.map(point => ({
          wavelength: point.wavelength,
          normalizedY: (getY(point) - min) / (max - min)
        }));
      } else {
        // If all values are the same, set all to 0.5
        normalizedData = sorted.map(point => ({
          wavelength: point.wavelength,
          normalizedY: 0.5
        }));
      }
    } else {
      // Fallback to original data if no valid values
      normalizedData = sorted.map(point => ({
        wavelength: point.wavelength,
        normalizedY: getY(point)
      }));
    }
  }

  const first = sorted[0].wavelength;
  const last = sorted[n - 1].wavelength;
  if (wave < first || wave > last) return 0;

  // binary search
  let low = 0, high = n - 1;
  if (sorted[0].wavelength === wave) {
    return normalize ? normalizedData[0].normalizedY : getY(sorted[0]);
  }
  if (sorted[high].wavelength === wave) {
    return normalize ? normalizedData[high].normalizedY : getY(sorted[high]);
  }

  while (low <= high) {
    const mid = (low + high) >> 1;
    const x = sorted[mid].wavelength;
    if (x === wave) {
      return normalize ? normalizedData[mid].normalizedY : getY(sorted[mid]);
    }
    if (x > wave) high = mid - 1;
    else low = mid + 1;
  }

  // interpolate between [high, low]
  const M = sorted[high];
  const N = sorted[low];
  
  if (normalize) {
    // Interpolate using normalized values
    const yM = normalizedData[high].normalizedY;
    const yN = normalizedData[low].normalizedY;
    return yM + (yN - yM) * (wave - M.wavelength) / (N.wavelength - M.wavelength);
  } else {
    // Interpolate using original values
    return getY(M) + (getY(N) - getY(M)) * (wave - M.wavelength) / (N.wavelength - M.wavelength);
  }
}

// GetSpectrumArea port:
// - xUnitType = 'wavenumber' or 'wavelength'
// - specType  = 'ems' or 'abs'
export function getSpectrumArea(
  sorted: SpectrumData[],
  xUnitType: "wavenumber" | "wavelength",
  specType: "ems" | "abs"
): number {
  let fluoArea = 0.0;       // for ems when requesting 'wavenumber' (uses 1e7 * Δλ trapezoid exactly like CS)
  let areaWavenumber = 0.0; // generic ν-domain area (uses Δν)
  let areaWavelength = 0.0; // λ-domain area (uses Δλ)

  for (let i = 1; i < sorted.length; i++) {
    const p1 = sorted[i - 1];
    const p2 = sorted[i];
    const v1 = 1e7 / p1.wavelength; // cm^-1
    const v2 = 1e7 / p2.wavelength; // cm^-1
    const deltaV = Math.abs(v1 - v2);
    const deltaX = Math.abs(p2.wavelength - p1.wavelength);

    // faithful to CS:
    // fluoArea += 1e7 * Δλ * (y1 + y2)/2    (used when specType === 'ems' and xUnitType === 'wavenumber')
    fluoArea += 1e7 * deltaX * ((specType === "ems" ? yE(p1) : yA(p1)) + (specType === "ems" ? yE(p2) : yA(p2))) / 2;

    // area in ν (generic)
    areaWavenumber += deltaV * (yA(p1) + yA(p2)) / 2; // matches CS path used for abs 'wavenumber'

    // area in λ
    areaWavelength += deltaX * ((specType === "ems" ? yE(p1) : yA(p1)) + (specType === "ems" ? yE(p2) : yA(p2))) / 2;
  }

  if (xUnitType === "wavenumber" && specType === "ems") return fluoArea;
  if (xUnitType === "wavenumber" && specType === "abs") return areaWavenumber;
  if (xUnitType === "wavelength") return areaWavelength;
  return 0;
}

// Compute (over the whole emission array) the two areas used by CS:
// fluoArea = 1e7 * Σ Δλ * (I1 + I2)/2
// fluoV3   = 1e7 * Σ Δλ * (I1/ν1^3 + I2/ν2^3)/2   with ν = 1e7/λ
export function emissionAreas_nu(emSorted: SpectrumData[]) {
  let fluoArea = 0;
  let fluoV3 = 0;
  for (let i = 1; i < emSorted.length; i++) {
    const p1 = emSorted[i - 1], p2 = emSorted[i];
    const v1 = 1e7 / p1.wavelength; // cm^-1
    const v2 = 1e7 / p2.wavelength; // cm^-1
    const dλ = Math.abs(p2.wavelength - p1.wavelength); // nm
    fluoArea += 1e7 * dλ * (yE(p1) + yE(p2)) / 2;
    fluoV3 += 1e7 * dλ * (yE(p1) / (v1 ** 3) + yE(p2) / (v2 ** 3)) / 2;
  }
  return { fluoArea, fluoV3 };
}


export function getConcentration(
  selectedSpectrum: SelectedSpectrum,
  pathLengthCm = 1 // Beer–Lambert path length (cm), default 1
): number {
  if (!selectedSpectrum || selectedSpectrum.type !== 'absorption') return 0;
  if (!Array.isArray(selectedSpectrum.data) || selectedSpectrum.data.length === 0) return 0;
  if (!(pathLengthCm > 0)) return 0;

  // Read ε and λ* from compound metadata
  const eps = parseFirstNumber(selectedSpectrum.compound?.absorption_epsilon);
  const lambdaStar = parseFirstNumber(selectedSpectrum.compound?.absorption_wavelength);
  console.log(eps,lambdaStar)
  if (!(eps && eps > 0) || !(lambdaStar && lambdaStar > 0)) return 0;

  // Sort and interpolate absorbance-like y at λ*
  const y = getNormalizedIntensity(selectedSpectrum.data, lambdaStar, selectedSpectrum.type === 'absorption' ? 'abs' : 'ems');
  console.log(y)
  if (!(y > 0)) return 0;

  // Beer–Lambert: A = ε c l  ->  c (M) = A / (ε l); return µM
  return  1000000 * y / (eps * pathLengthCm);
  // return conc_M;
}

/** Extract first valid number from a string/number (handles commas/units). */
function parseFirstNumber(val: string | number | undefined): number | undefined {
  if (val == null) return undefined;
  if (typeof val === 'number') return Number.isFinite(val) ? val : undefined;
  const m = String(val).replace(/,/g, '').match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/);
  if (!m) return undefined;
  const num = parseFloat(m[0]);
  return Number.isFinite(num) ? num : undefined;
}

/** Linear interpolation on (λ, yGetter); out-of-range → 0 (C#-like behavior). */
function interpAt(
  sorted: SpectrumData[],
  wave: number,
  getY: (p: SpectrumData) => number
): number {
  const n = sorted.length;
  if (n === 0) return 0;
  if (n === 1) return getY(sorted[0]);

  const first = sorted[0].wavelength;
  const last  = sorted[n - 1].wavelength;
  if (wave < first || wave > last) return 0;
  if (wave === first) return getY(sorted[0]);
  if (wave === last)  return getY(sorted[n - 1]);

  // binary search
  let lo = 0, hi = n - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const x = sorted[mid].wavelength;
    if (x === wave) return getY(sorted[mid]);
    if (x > wave) hi = mid - 1; else lo = mid + 1;
  }

  const M = sorted[hi], N = sorted[lo];
  const yM = getY(M), yN = getY(N);
  return yM + (yN - yM) * (wave - M.wavelength) / (N.wavelength - M.wavelength);
}