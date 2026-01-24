import { getNormalizedIntensity } from "./helpers";

export type SimulationMode = "forward" | "reverse";

export interface ETComponentInput {
    id: string;
    name: string;
    /** "Epsilon" column in C#: absorbance proxy at excitation (any nonnegative weight). */
    E: number;
    /** QY column in C#: quantum yield (0..1). */
    QY: number;
    /** Initial T column in C#: transfer efficiency guess (0..1). */
    T: number;
}

export interface ReverseOptions {
    /** Selected wavelengths (nm) to compare composite vs. linear combo of components. */
    selectedWavelengths: number[];
    /** If true, last T is fixed at 0 (C# "Reverse Analysis (last T = 0)") */
    zeroLastT?: boolean; // default true
    /** Nelder–Mead iterations */
    maxIter?: number; // default 1000
    /** Base tolerance before scaling (C#: 1e-9 then scaled by composite max) */
    baseTol?: number; // default 1e-9
    /** Bounds for T */
    bounds?: { low?: number; high?: number }; // default [0,1]
}

export interface ForwardResultPerComponent {
    id: string;
    name: string;
    E: number;
    fracE: number;
    QY: number;
    T: number;
    QYPrime: number;
}

export interface ForwardResult {
    mode: "forward";
    components: ForwardResultPerComponent[];
    totalQY: number;
}

export interface ReverseWaveResult {
    wavelength: number;
    calculated: number;   // Σ Q′_j * I_j(λ)
    experimental: number; // I_mix(λ)
    residual: number;     // calc - exp
}

export interface ReverseResult {
    mode: "reverse";
    components: Array<{
        id: string;
        name: string;
        E: number;
        fracE: number;
        QY: number;
        T: number;
        QYPrime: number;
    }>;
    totalQY: number;
    /** optimized T (length = n or n-1 if zeroLastT, but last T will be 0 in returned components) */
    optimizedT: number[];
    /** √∑ residual^2 across selected wavelengths (C# "lsq") */
    lsq: number;
    rSquared: number;
    meanResidual: number;
    maxResidual: number;
    wavelengths: ReverseWaveResult[];
}

/* -------------------------- Public API -------------------------- */

/** Forward simulation: compute Q′ from E, QY, T (no spectra required). */
export function calcEnergyTransferForward(
    components: ETComponentInput[]
): ForwardResult {
    const { fracE } = fractionsFromE(components.map(c => c.E));
    const out: ForwardResultPerComponent[] = [];
    let totalQY = 0;
    let excTransTotal = 0;

    for (let i = 0; i < components.length; i++) {
        const f = fracE[i];
        const QY = clamp01(components[i].QY);
        const T = clamp01(components[i].T);
        const Qp = (f + excTransTotal) * QY * (1 - T);
        excTransTotal = (excTransTotal + f) * T;
        totalQY += Qp;
        out.push({
            id: components[i].id,
            name: components[i].name,
            E: components[i].E,
            fracE: f,
            QY,
            T,
            QYPrime: Qp,
        });
    }

    return { mode: "forward", components: out, totalQY };
}

/** Reverse analysis (simplex): first spectrum = composite (array), others = components.
 *  - Uses emission spectra (normalized field) at the selected wavelengths.
 *  - Fits Σ Q′_j(T) * I_j(λ) to composite I_mix(λ) by optimizing T.
 */
export function calcEnergyTransferReverse(
    emissionSpectra: SelectedSpectrum[],        // first is composite
    componentsInput: ETComponentInput[],        // should correspond to emissionSpectra.slice(1) by id
    options: ReverseOptions
): ReverseResult {
    if (!emissionSpectra?.length || emissionSpectra.length < 2) {
        throw new Error("Need at least composite + one component emission spectrum.");
    }
    if (!options?.selectedWavelengths?.length) {
        throw new Error("No selected wavelengths for reverse analysis.");
    }
    // Sanitize wavelengths and sort
    const waves = [...new Set(options.selectedWavelengths.filter(Number.isFinite))]
        .sort((a, b) => a - b);

    // Composite + components (emission, normalized)
    const composite = emissionSpectra[0];
    const compSpecs = emissionSpectra.slice(1);
    ensureAllEmission([composite, ...compSpecs]);

    // Build intensity matrices at λ_i
    const yMix = waves.map(w => getNormalizedIntensity(composite.data, w, 'abs'));             // experimental
    const A: number[][] = compSpecs.map(s => waves.map(w => getNormalizedIntensity(s.data, w, 'abs'))); // per-component across λ

    // Map UI components to spectrum components by id
    const order: number[] = compSpecs.map(s => {
        const idx = componentsInput.findIndex(c => c.id === s.compound.id);
        if (idx < 0) throw new Error(`No component input for spectrum id ${s.compound.id}`);
        return idx;
    });
    const ordered = order.map(i => componentsInput[i]);

    // Fractional absorbances (from E) and QY/T arrays in matching order
    const E = ordered.map(c => Math.max(0, c.E || 0));
    const QY = ordered.map(c => clamp01(c.QY || 0));
    const T0full = ordered.map(c => clamp01(c.T || 0));

    const { fracE } = fractionsFromE(E);

    // zeroLastT handling
    const zeroLastT = options.zeroLastT !== false; // default true
    const n = ordered.length;
    const nVars = zeroLastT ? Math.max(0, n - 1) : n;
    const T0 = T0full.slice(0, nVars);

    // Bounds and tolerance scaling (like C#)
    const low = options.bounds?.low ?? 0;
    const high = options.bounds?.high ?? 1;
    const maxIter = options.maxIter ?? 1000;
    const baseTol = options.baseTol ?? 1e-9;

    const maxY = Math.max(...yMix.map(v => Math.abs(v)), 0);
    const tol = (maxY > 0) ? baseTol * maxY : baseTol;

    // Objective = NM over T (nVars), cost(T) = SpectrumObjectFunction(Q′(T))
    const cost = (Tvars: number[]) => {
        const Tfull = zeroLastT ? [...Tvars, 0] : Tvars.slice();
        const Qp = computeQPrime(fracE, QY, Tfull);
        return spectrumObjective(Qp, A, yMix);
    };

    // Simplex init (C#-style): X[0]=user guess, others = axis points set to that coord
    const sol = nelderMeadBoxWithMidRecenter(T0, cost, { low, high, maxIter, tol });

    const TbestVars = sol.bestX.slice();
    const TbestFull = zeroLastT ? [...TbestVars, 0] : TbestVars;
    const QpBest = computeQPrime(fracE, QY, TbestFull);
    const yCalc = multiplyAx(A, QpBest);
    const residuals = yCalc.map((c, i) => c - yMix[i]);

    const sse = sumSq(residuals);
    const lsq = Math.sqrt(sse);
    const mean = yMix.reduce((a, v) => a + v, 0) / yMix.length;
    const sst = yMix.reduce((a, v) => a + (v - mean) ** 2, 0);
    const r2 = sst > 0 ? 1 - sse / sst : 0;
    const meanRes = residuals.reduce((a, r) => a + Math.abs(r), 0) / residuals.length;
    const maxRes = Math.max(...residuals.map(r => Math.abs(r)));

    let totalQY = 0;
    const outComponents = ordered.map((c, i) => {
        totalQY += QpBest[i];
        return {
            id: c.id,
            name: c.name,
            E: E[i],
            fracE: fracE[i],
            QY: QY[i],
            T: TbestFull[i],
            QYPrime: QpBest[i],
        };
    });

    return {
        mode: "reverse",
        components: outComponents,
        totalQY,
        optimizedT: TbestFull,
        lsq,
        rSquared: r2,
        meanResidual: meanRes,
        maxResidual: maxRes,
        wavelengths: waves.map((w, i) => ({
            wavelength: w,
            calculated: yCalc[i],
            experimental: yMix[i],
            residual: residuals[i],
        })),
    };
}

/* ----------------------- Internal helpers ----------------------- */

function computeQPrime(fracE: number[], QY: number[], T: number[]): number[] {
    // Q′ cascade (C# EnergyTransferCostFunction)
    const n = fracE.length;
    const out = new Array(n);
    let excTransTotal = 0;
    for (let i = 0; i < n; i++) {
        const Ti = clamp01(T[i] ?? 0);
        const Qi = clamp01(QY[i] ?? 0);
        const Qp = (fracE[i] + excTransTotal) * Qi * (1 - Ti);
        excTransTotal = (excTransTotal + fracE[i]) * Ti;
        out[i] = Qp;
    }
    return out;
}

function fractionsFromE(E: number[]) {
    const sumE = E.reduce((a, v) => a + Math.max(0, v || 0), 0);
    const fracE = sumE > 0 ? E.map(v => Math.max(0, v || 0) / sumE) : E.map(_ => 0);
    return { fracE, sumE };
}

function ensureAllEmission(specs: SelectedSpectrum[]) {
    for (const s of specs) {
        if (s.type !== "emission") throw new Error("All spectra must be emission for energy transfer analysis.");
    }
}

/** Same objective as FlexibleSimplex.SpectrumObjectFunction but with conc=Q′ */
function spectrumObjective(Qp: number[], A: number[][], y: number[]): number {
    // yCalc_i = Σ_j Qp_j * A[j][i]
    const yCalc = multiplyAx(A, Qp);
    return Math.sqrt(sumSq(yCalc.map((c, i) => c - y[i])));
}

function multiplyAx(A: number[][], x: number[]): number[] {
    const m = A[0]?.length ?? 0; // #wavelengths
    const n = A.length;          // #components
    const out = new Array(m).fill(0);
    for (let j = 0; j < n; j++) {
        const col = A[j];
        const w = x[j] || 0;
        if (!w) continue;
        for (let i = 0; i < m; i++) out[i] += w * col[i];
    }
    return out;
}

function sumSq(arr: number[]) {
    let s = 0;
    for (let i = 0; i < arr.length; i++) s += arr[i] * arr[i];
    return s;
}

export function clamp01(x: number) { return x < 0 ? 0 : x > 1 ? 1 : x; }

/** Box-constrained Nelder–Mead with mid-range recentering like the C# reverse step. */
function nelderMeadBoxWithMidRecenter(
    x0: number[],
    f: (x: number[]) => number,
    cfg: { low: number; high: number; maxIter: number; tol: number }
): { bestX: number[]; bestF: number } {
    const { low, high, maxIter, tol } = cfg;
    const n = x0.length;
    if (n === 0) return { bestX: [], bestF: f([]) };

    const numPts = n + 1;
    const reflect = 1, expand = 2, contract = 0.5;

    // initial simplex: X[0] = x0, X[i] = axis point with same coord as x0[i-1]
    const X: number[][] = Array.from({ length: numPts }, () => new Array(n).fill(0));
    X[0] = x0.slice();
    for (let i = 1; i < numPts; i++) {
        X[i][i - 1] = x0[i - 1];
    }
    midRecenterAll(X, low, high);

    let Y = X.map(f);

    let iter = 0;
    while (iter++ < maxIter) {
        let best = 0, worst = 0;
        for (let i = 1; i < numPts; i++) {
            if (Y[i] < Y[best]) best = i;
            if (Y[i] > Y[worst]) worst = i;
        }

        // centroid (exclude worst)
        const C = new Array(n).fill(0);
        for (let i = 0; i < numPts; i++) if (i !== worst) {
            for (let k = 0; k < n; k++) C[k] += X[i][k];
        }
        for (let k = 0; k < n; k++) C[k] /= n;

        // reflect
        const XR = new Array(n);
        for (let k = 0; k < n; k++) XR[k] = (1 + reflect) * C[k] - reflect * X[worst][k];
        midRecenter(XR, low, high);
        const fR = f(XR);

        if (fR < Y[best]) {
            // expand
            const XE = new Array(n);
            for (let k = 0; k < n; k++) XE[k] = (1 + expand) * XR[k] - expand * C[k];
            midRecenter(XE, low, high);
            const fE = f(XE);
            X[worst] = (fE < fR) ? XE : XR;
            Y[worst] = (fE < fR) ? fE : fR;
        } else {
            // check if reflect worse than any non-worst
            let isWorseThanSome = false;
            for (let i = 0; i < numPts; i++) {
                if (i !== worst && fR > Y[i]) { isWorseThanSome = true; break; }
            }
            if (isWorseThanSome) {
                if (fR < Y[worst]) { X[worst] = XR.slice(); Y[worst] = fR; }
                // contract
                const XC = new Array(n);
                for (let k = 0; k < n; k++) XC[k] = contract * X[worst][k] + (1 - contract) * C[k];
                midRecenter(XC, low, high);
                const fC = f(XC);
                if (fC > Y[worst]) {
                    // shrink toward best
                    const Xbest = X[best].slice();
                    for (let i = 0; i < numPts; i++) {
                        for (let k = 0; k < n; k++) X[i][k] = 0.5 * (Xbest[k] + X[i][k]);
                        midRecenter(X[i], low, high);
                        Y[i] = f(X[i]);
                    }
                } else {
                    X[worst] = XC; Y[worst] = fC;
                }
            } else {
                X[worst] = XR.slice(); Y[worst] = fR;
            }
        }

        // convergence by stddev(Y)
        const mean = Y.reduce((a, v) => a + v, 0) / numPts;
        let sumsq = 0; for (const v of Y) { const d = v - mean; sumsq += d * d; }
        const sd = Math.sqrt(sumsq / numPts);
        if (sd <= tol) break;
    }

    let bestI = 0;
    for (let i = 1; i < numPts; i++) if (Y[i] < Y[bestI]) bestI = i;
    return { bestX: X[bestI].slice(), bestF: Y[bestI] };
}

/** C# reverse uses “mid-range recentering” when out-of-bounds. */
function midRecenter(vec: number[], low: number, high: number) {
    const a = (low + high) / 3;
    const b = 2 * (low + high) / 3;
    for (let i = 0; i < vec.length; i++) {
        if (vec[i] < low) vec[i] = a;
        else if (vec[i] > high) vec[i] = b;
    }
}
function midRecenterAll(X: number[][], low: number, high: number) {
    for (const row of X) midRecenter(row, low, high);
}
