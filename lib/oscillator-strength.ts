interface OscillatorStrengthParams {
  lowWavelength: number;
  highWavelength: number;
  wavelengthForEpsilon: number;
  epsilon: number;
}

interface OscillatorStrengthResults {
  oscillatorStrength: number;
  transitionDipoleMomentDebye: number;
  transitionDipoleMomentCm: number;
}

export function calculateOscillatorStrength(
  spectralData: SpectrumData[],
  params: OscillatorStrengthParams
): OscillatorStrengthResults | null {
  const { epsilon, wavelengthForEpsilon, highWavelength, lowWavelength } = params;

  // Validate input data
  if (!Array.isArray(spectralData) || spectralData.length < 3) {
    return null;
  }

  // Normalize and validate data points
  const data = spectralData
    .map(p => ({ wavelength: Number(p.wavelength), coefficient: Number(p.coefficient ?? 0) }))
    .filter(p => Number.isFinite(p.wavelength) && Number.isFinite(p.coefficient));

  if (data.length < 3) {
    return null;
  }

  // Detect storage direction (ascending/descending wavelength)
  const ascending = data[0].wavelength <= data[data.length - 1].wavelength;

  // Adjust search range to data boundaries
  const firstW = data[0].wavelength;
  const lastW = data[data.length - 1].wavelength;

  let low = lowWavelength;
  let high = highWavelength;

  if (ascending) {
    if (firstW > low) low = firstW + 1;
    if (lastW < high) high = lastW - 1;
  } else {
    if (lastW > low) low = lastW + 1;
    if (firstW < high) high = firstW - 1;
  }

  if (!(low < high)) {
    return null;
  }

  // Find indices for wavelength range
  const findIndexForWavelength = (w: number) => {
    let idx = 0;
    if (ascending) {
      while (idx < data.length - 1 && data[idx].wavelength < w) idx++;
    } else {
      while (idx < data.length - 1 && data[idx].wavelength > w) idx++;
    }
    return idx;
  };

  const startIdx = findIndexForWavelength(low);
  const endIdx = findIndexForWavelength(high);
  const i0 = Math.min(startIdx, endIdx);
  const i1 = Math.max(startIdx, endIdx);

  if (i1 - i0 < 2) {
    return null;
  }

  const window = data.slice(i0, i1 + 1);

  // Find peak within window
  let peakMax = -Infinity;
  let peakIndex = -1;
  for (let i = 0; i < window.length; i++) {
    const c = window[i].coefficient;
    if (c > peakMax) {
      peakMax = c;
      peakIndex = i;
    }
  }

  if (peakIndex <= 1 || peakIndex >= window.length - 2 || !Number.isFinite(peakMax) || peakMax <= 0) {
    return null;
  }

  const peakWavelength = window[peakIndex].wavelength;

  // Interpolate intensity at database epsilon wavelength
  const interpolateAt = (arr: typeof data, targetW: number): number => {
    if (ascending) {
      for (let i = 0; i < arr.length - 1; i++) {
        const a = arr[i], b = arr[i + 1];
        if (a.wavelength <= targetW && targetW <= b.wavelength) {
          const t = (targetW - a.wavelength) / (b.wavelength - a.wavelength || 1);
          return a.coefficient + t * (b.coefficient - a.coefficient);
        }
      }
    } else {
      for (let i = 0; i < arr.length - 1; i++) {
        const a = arr[i], b = arr[i + 1];
        if (a.wavelength >= targetW && targetW >= b.wavelength) {
          const t = (targetW - a.wavelength) / (b.wavelength - a.wavelength || 1);
          return a.coefficient + t * (b.coefficient - a.coefficient);
        }
      }
    }
    
    // Fallback to nearest point
    let nearest = arr[0];
    let best = Math.abs(arr[0].wavelength - targetW);
    for (const p of arr) {
      const d = Math.abs(p.wavelength - targetW);
      if (d < best) {
        best = d;
        nearest = p;
      }
    }
    return nearest.coefficient;
  };

  const intensityAtDbWavelength = interpolateAt(data, wavelengthForEpsilon);
  const peakEpsilon = epsilon * (peakMax / (intensityAtDbWavelength || peakMax));

  // Find half-maximum crossings
  const half = peakMax / 2;

  // Search towards lower indices
  let halfLeftW: number | null = null;
  for (let i = peakIndex; i > 0; i--) {
    const M = window[i];
    const N = window[i - 1];
    const fM = M.coefficient, fN = N.coefficient;
    if (fM >= half && fN <= half && fM !== fN) {
      const dx = N.wavelength - M.wavelength;
      const dy = fN - fM;
      halfLeftW = M.wavelength + (half - fM) * (dx / dy);
      break;
    }
  }

  // Search towards higher indices
  let halfRightW: number | null = null;
  for (let i = peakIndex; i < window.length - 1; i++) {
    const M = window[i];
    const N = window[i + 1];
    const fM = M.coefficient, fN = N.coefficient;
    if (fM >= half && fN <= half && fM !== fN) {
      const dx = N.wavelength - M.wavelength;
      const dy = fN - fM;
      halfRightW = M.wavelength + (half - fM) * (dx / dy);
      break;
    }
  }

  // Fallback to window edges if interpolation failed
  const halfPeak1 = Number.isFinite(halfLeftW!) ? halfLeftW! : low;
  const halfPeak2 = Number.isFinite(halfRightW!) ? halfRightW! : high;

  // Ensure proper ordering
  const halfLow = Math.min(halfPeak1, halfPeak2);
  const halfHigh = Math.max(halfPeak1, halfPeak2);

  // Convert to wavenumbers (cm^-1)
  const v1 = 1e7 / halfLow;
  const v2 = 1e7 / halfHigh;
  let halfPeakWidth = Math.abs(v1 - v2);

  // Peak wavenumber (cm^-1)
  const peakWavenumber = 1e7 / peakWavelength;

  // Calculate oscillator strength
  const oscillatorStrength = 4.32e-9 * peakEpsilon * halfPeakWidth;

  // Calculate transition dipole moment
  const mu_SI = (oscillatorStrength > 0 && peakWavenumber > 0)
    ? 4.86e-27 * Math.sqrt(oscillatorStrength / peakWavenumber)
    : 0;

  // Convert to Debye
  const mu_Debye = mu_SI / 3.33564e-30;

  // Validate results
  const validOscillatorStrength =
    Number.isFinite(oscillatorStrength) && oscillatorStrength > 0 ? oscillatorStrength : 0;

  const validMuSI =
    Number.isFinite(mu_SI) && mu_SI > 0 ? mu_SI : 0;

  const validMuDebye =
    Number.isFinite(mu_Debye) && mu_Debye > 0 ? mu_Debye : 0;

  return {
    oscillatorStrength: validOscillatorStrength,
    transitionDipoleMomentCm: validMuSI,
    transitionDipoleMomentDebye: validMuDebye,
  };
}
