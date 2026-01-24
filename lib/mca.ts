import { getIntensity, getNormalizedIntensity } from "./helpers";

// Types you already have in your project
export interface SpectrumData {
  compound_id: string;
  wavelength: number;   // nm
  coefficient?: number; // absorption Y
  normalized?: number;  // emission Y
}

export interface Compound {
  id: string;
  name: string;
  database_name: string;
  solvent?: string;
}

export interface SelectedSpectrum {
  compound: Compound;
  type: "absorption" | "emission";
  data: SpectrumData[];
}

export interface ComponentInput {
  compound: Compound;
  concentration: number;   // µM
  initialFraction: number; // user guess
}

export interface ComponentOutput extends ComponentInput {
  actualFraction: number;        // fitted
  actualConcentration: number;   // µM = fraction * concentration
}

export interface MCAOptions {
  selectedWavelengths: number[];
  minWavelength: number;  // nm (display only, we still use selectedWavelengths explicitly)
  maxWavelength: number;  // nm
  components: ComponentInput[];  // must align with componentSpectra order
}

export interface MCAResults {
  lsq: number; // best sqrt(Σ residual^2)
  components: ComponentOutput[];
  wavelengthResults: Array<{
    wavelength: number;
    calculatedAbsorbance: number;
    experimentalAbsorbance: number;
    residual: number;
  }>;
  overallFit: {
    rSquared: number;
    meanResidual: number;
    maxResidual: number;
  };
}

/* ================= FlexibleSimplex (TS port of your C#) ================= */

class FlexibleSimplexTS {
  tolerance = 1e-9; // will be scaled by caller like in C#
  m_pAllComponentsIntensities: number[][] = []; // [comp][iWave]
  m_pCompositeIntensities: number[] = [];      // [iWave]
  _pFractions: number[] = [];                  // initial guess
  m_numWaves = 0;
  m_numVars = 0;

  pFractions: number[] = [];                   // solution (best vertex)

  /** √(Σ_i ( Σ_j conc[j]*comp[j][i] - composite[i] )^2 ) */
  private spectrumObjective(conc: number[]): number {
    let lsq = 0;
    for (let i = 0; i < this.m_numWaves; i++) {
      let sum = 0;
      for (let j = 0; j < this.m_numVars; j++) {
        sum += conc[j] * this.m_pAllComponentsIntensities[j][i];
      }
      const r = sum - this.m_pCompositeIntensities[i];
      lsq += r * r;
    }
    return Math.sqrt(lsq);
  }

  /** Port of RunContraintMultipleanalysis(low, high) */
  runConstrained(low: number, high: number): number {
    this.pFractions = [];
    const reflect = 1.0, expand = 2.0, contract = 0.5;
    const numPoints = this.m_numVars + 1;
    const maxIter = 1000;

    // X: flattened simplex vertices (numPoints x m_numVars), Y: objective values
    const X = new Float64Array(numPoints * this.m_numVars).fill(0);
    const Y = new Float64Array(numPoints);
    const X1 = new Float64Array(this.m_numVars);
    const X2 = new Float64Array(this.m_numVars);
    const C  = new Float64Array(this.m_numVars);

    // Initial simplex — identical to C#:
    // vertex 0 = user guess; vertex i sets only coordinate (i-1) to that guess, others zero
    for (let j = 0; j < this.m_numVars; j++) X[j] = this._pFractions[j] ?? 0;
    for (let i = 1; i < numPoints; i++) {
      const idx = i * this.m_numVars + (i - 1);
      X[idx] = this._pFractions[i - 1] ?? 0;
    }

    // Evaluate Y
    for (let i = 0; i < numPoints; i++) {
      for (let j = 0; j < this.m_numVars; j++) X1[j] = X[i * this.m_numVars + j];
      Y[i] = this.spectrumObjective(Array.from(X1));
    }

    let iter = 0;
    while (iter++ < maxIter) {
      // find best and worst
      let worstI = 0, bestI = 0;
      for (let i = 1; i < numPoints; i++) {
        if (Y[i] < Y[bestI]) bestI = i;
        else if (Y[i] > Y[worstI]) worstI = i;
      }

      // centroid of all except worst
      for (let j = 0; j < this.m_numVars; j++) {
        let s = 0;
        for (let i = 0; i < numPoints; i++) if (i !== worstI) s += X[i * this.m_numVars + j];
        C[j] = s / this.m_numVars;
      }

      // reflected point: X1 = (1+α)C − α X_worst, clamped
      for (let j = 0; j < this.m_numVars; j++) {
        X1[j] = (1 + reflect) * C[j] - reflect * X[worstI * this.m_numVars + j];
        if (X1[j] < low) X1[j] = low; else if (X1[j] > high) X1[j] = high;
      }
      let y1 = this.spectrumObjective(Array.from(X1));

      if (y1 < Y[bestI]) {
        // expanded: X2 = (1+γ)X1 − γ C, clamped
        for (let j = 0; j < this.m_numVars; j++) {
          X2[j] = (1 + expand) * X1[j] - expand * C[j];
          if (X2[j] < low) X2[j] = low; else if (X2[j] > high) X2[j] = high;
        }
        const y2 = this.spectrumObjective(Array.from(X2));
        // replace worst with better of X2 / X1
        const src = (y2 < Y[bestI]) ? X2 : X1;
        for (let j = 0; j < this.m_numVars; j++) X[worstI * this.m_numVars + j] = src[j];
      } else {
        // is y1 worse than all except worst? (flag in C#)
        let worseThanAll = true;
        for (let i = 0; i < numPoints; i++) {
          if (i !== worstI && y1 <= Y[i]) { worseThanAll = false; break; }
        }

        if (worseThanAll) {
          // maybe accept reflected into worst
          if (y1 < Y[worstI]) {
            for (let j = 0; j < this.m_numVars; j++) X[worstI * this.m_numVars + j] = X1[j];
            Y[worstI] = y1;
          }
          // contracted: X2 = β X_worst + (1-β) C, clamped
          for (let j = 0; j < this.m_numVars; j++) {
            X2[j] = contract * X[worstI * this.m_numVars + j] + (1 - contract) * C[j];
            if (X2[j] < low) X2[j] = low; else if (X2[j] > high) X2[j] = high;
          }
          const y2 = this.spectrumObjective(Array.from(X2));

          if (y2 > Y[worstI]) {
            // shrink towards best
            const bestBase = bestI * this.m_numVars;
            for (let j = 0; j < this.m_numVars; j++) X2[j] = X[bestBase + j];
            for (let i = 0; i < numPoints; i++) {
              for (let j = 0; j < this.m_numVars; j++) {
                X[i * this.m_numVars + j] = 0.5 * (X2[j] + X[i * this.m_numVars + j]);
              }
            }
          } else {
            // replace worst by contracted point
            for (let j = 0; j < this.m_numVars; j++) X[worstI * this.m_numVars + j] = X2[j];
          }
        } else {
          // accept reflected into worst
          for (let j = 0; j < this.m_numVars; j++) X[worstI * this.m_numVars + j] = X1[j];
        }
      }

      // re-evaluate all Y (with clamping like C# does inside loop)
      for (let i = 0; i < numPoints; i++) {
        for (let j = 0; j < this.m_numVars; j++) {
          X1[j] = X[i * this.m_numVars + j];
          if (X1[j] < low) X1[j] = low; else if (X1[j] > high) X1[j] = high;
        }
        Y[i] = this.spectrumObjective(Array.from(X1));
      }

      // convergence test: stddev(Y) <= tolerance ?
      let mean = 0;
      for (let i = 0; i < numPoints; i++) mean += Y[i];
      mean /= numPoints;
      let varsum = 0;
      for (let i = 0; i < numPoints; i++) { const d = Y[i] - mean; varsum += d * d; }
      const converged = Math.sqrt(varsum / numPoints) <= this.tolerance;
      if (converged) break;
    }

    // best vertex -> pFractions
    let bestI = 0;
    for (let i = 1; i < numPoints; i++) if (Y[i] < Y[bestI]) bestI = i;
    const best = new Array(this.m_numVars);
    for (let j = 0; j < this.m_numVars; j++) {
      best[j] = X[bestI * this.m_numVars + j];
      this.pFractions.push(best[j]);
    }
    return Y[bestI];
  }
}


/* ================= Public API (mirrors your C# MCA flow) ================= */

export function calculateMultipleComponentAnalysisSimplex(
  validSpectra: SelectedSpectrum[],   // first = composite; others = components (same type)
  options: MCAOptions
): MCAResults | null {
  if (!validSpectra || validSpectra.length < 3) return null;
  const composite = validSpectra[0];
  console.log("VALID",validSpectra)
  const componentSpectra = validSpectra.slice(1);
  console.log("FIRST",componentSpectra)
  const nVars = componentSpectra.length;

  // wavelengths: unique, sorted, within provided [min,max]
  const waves = [...new Set(
    options.selectedWavelengths
      .filter(w => Number.isFinite(w) && w >= options.minWavelength && w <= options.maxWavelength)
  )].sort((a, b) => a - b);

  if (waves.length <= nVars) {
    // matches C#: need strictly more equations (wavelengths) than variables (components)
    return null;
  }

  // Build intensities arrays exactly like C#
  const allCompIntens: number[][] = []; // [comp][iWave]
  for (let j = 0; j < nVars; j++) {
    const spec = componentSpectra[j];
    const arr = waves.map(w => getNormalizedIntensity(spec.data, w));
    allCompIntens.push(arr);
  }

  const compositeIntens: number[] = waves.map(w => getNormalizedIntensity(composite.data, w));

  // tolerance scaling like your C# caller
  const maxComposite = compositeIntens.reduce((m, v) => Math.max(m, v), 0);
  let tol = 1e-9;
  if (maxComposite > 1) tol *= 1 / maxComposite;
  else if (maxComposite > 0) tol *= maxComposite;

  // initial fractions come from UI (like your DataGrid col 2)
  const initFracs: number[] =
    (options.components?.length === nVars)
      ? options.components.map(c => +c.initialFraction || 0)
      : Array(nVars).fill(1 / nVars);

  // Set up and run simplex (bounded [0, 10000] like C# call)
  const simplex = new FlexibleSimplexTS();
  simplex.tolerance = tol;
  simplex.m_pAllComponentsIntensities = allCompIntens;
  simplex.m_pCompositeIntensities = compositeIntens;
  simplex._pFractions = initFracs;
  simplex.m_numVars = nVars;
  simplex.m_numWaves = waves.length;

  const lsq = simplex.runConstrained(0, 10000);

  // Predicted & residuals
  const x = simplex.pFractions;
  const yhat = waves.map((_, i) => {
    let s = 0;
    for (let j = 0; j < nVars; j++) s += x[j] * allCompIntens[j][i];
    return s;
  });
  const residuals = yhat.map((y, i) => y - compositeIntens[i]);
  const meanB = compositeIntens.reduce((s, v) => s + v, 0) / compositeIntens.length;
  const ssRes = residuals.reduce((s, r) => s + r * r, 0);
  const ssTot = compositeIntens.reduce((s, v) => s + (v - meanB) * (v - meanB), 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  // Components out (align with componentSpectra order and map to correct compound IDs)
  const componentsOut: ComponentOutput[] = componentSpectra.map((spec, j) => {
    // Find the matching component in options.components by compound ID
    const base = options.components?.find(comp => comp.compound.id === spec.compound.id);
    const conc = base?.concentration ?? 0;
    
    console.log(`Mapping component ${j}:`, {
      spectrumCompoundId: spec.compound.id,
      spectrumCompoundName: spec.compound.name,
      foundBase: !!base,
      baseCompoundId: base?.compound.id,
      actualFraction: x[j],
      concentration: conc
    });
    
    return {
      compound: spec.compound, // Always use the compound from the spectrum data
      concentration: conc,
      initialFraction: base?.initialFraction ?? initFracs[j],
      actualFraction: x[j] ?? 0,
      actualConcentration: (x[j] ?? 0) * conc
    };
  });

  return {
    lsq,
    components: componentsOut,
    wavelengthResults: waves.map((λ, i) => ({
      wavelength: λ,
      calculatedAbsorbance: yhat[i],
      experimentalAbsorbance: compositeIntens[i],
      residual: residuals[i]
    })),
    overallFit: {
      rSquared: r2,
      meanResidual: residuals.length ? residuals.reduce((s, r) => s + Math.abs(r), 0) / residuals.length : 0,
      maxResidual: residuals.length ? Math.max(...residuals.map(r => Math.abs(r))) : 0
    }
  };
}
