// Distribution calculation functions for spectrum comparison

export interface DistributionParams {
  type: 'blackbody' | 'gaussian' | 'lorentzian';
  lowWavelength: number;
  highWavelength: number;
  // Blackbody specific
  temperature?: number;
  // Gaussian specific
  peakWavelength?: number;
  standardDeviation?: number;
  gaussianMultiplier?: number;
  // Lorentzian specific
  lorentzianPeakWavelength?: number;
  fwhm?: number;
  lorentzianMultiplier?: number;
}

export interface DistributionPoint {
  wavelength: number;
  intensity: number;
}

// Planck's constant in J⋅s
const h = 6.62607015e-34;
// Speed of light in m/s
const c = 299792458;
// Boltzmann constant in J/K
const k = 1.380649e-23;

/**
 * Calculate blackbody radiation spectrum
 */
export function calculateBlackbodySpectrum(
  lowWavelength: number,
  highWavelength: number,
  temperature: number,
  numPoints: number = 1000
): DistributionPoint[] {
  const points: DistributionPoint[] = [];
  const step = (highWavelength - lowWavelength) / (numPoints - 1);
  
  for (let i = 0; i < numPoints; i++) {
    const wavelength = lowWavelength + i * step; // nm
    const wavelengthM = wavelength * 1e-9; // Convert to meters
    
    // Planck's law for spectral radiance
    const numerator = 2 * h * c * c;
    const denominator = Math.pow(wavelengthM, 5) * (Math.exp((h * c) / (wavelengthM * k * temperature)) - 1);
    
    // Convert to relative units and scale appropriately
    const intensity = numerator / denominator;
    
    points.push({
      wavelength,
      intensity: intensity
    });
  }
  
  // Normalize to reasonable scale for visualization
  const maxIntensity = Math.max(...points.map(p => p.intensity));
  if (maxIntensity > 0) {
    points.forEach(point => {
      point.intensity = point.intensity / maxIntensity;
    });
  }
  
  return points;
}

/**
 * Calculate Gaussian distribution
 */
export function calculateGaussianSpectrum(
  lowWavelength: number,
  highWavelength: number,
  peakWavelength: number,
  standardDeviation: number,
  multiplier: number = 1,
  numPoints: number = 1000
): DistributionPoint[] {
  const points: DistributionPoint[] = [];
  const step = (highWavelength - lowWavelength) / (numPoints - 1);
  
  for (let i = 0; i < numPoints; i++) {
    const wavelength = lowWavelength + i * step;
    
    // Gaussian function
    const exponent = -Math.pow((wavelength - peakWavelength) / standardDeviation, 2) / 2;
    const intensity = multiplier * Math.exp(exponent);
    
    points.push({
      wavelength,
      intensity
    });
  }
  
  // Normalize to reasonable scale for visualization
  const maxIntensity = Math.max(...points.map(p => p.intensity));
  if (maxIntensity > 0) {
    points.forEach(point => {
      point.intensity = point.intensity / maxIntensity;
    });
  }
  
  return points;
}

/**
 * Calculate Lorentzian distribution
 */
export function calculateLorentzianSpectrum(
  lowWavelength: number,
  highWavelength: number,
  peakWavelength: number,
  fwhm: number,
  multiplier: number = 1,
  numPoints: number = 1000
): DistributionPoint[] {
  const points: DistributionPoint[] = [];
  const step = (highWavelength - lowWavelength) / (numPoints - 1);
  
  // Convert FWHM to gamma parameter
  const gamma = fwhm / 2;
  
  for (let i = 0; i < numPoints; i++) {
    const wavelength = lowWavelength + i * step;
    
    // Lorentzian function
    const denominator = Math.pow(wavelength - peakWavelength, 2) + Math.pow(gamma, 2);
    const intensity = multiplier * Math.pow(gamma, 2) / (Math.PI * denominator);
    
    points.push({
      wavelength,
      intensity
    });
  }
  
  // Normalize to reasonable scale for visualization
  const maxIntensity = Math.max(...points.map(p => p.intensity));
  if (maxIntensity > 0) {
    points.forEach(point => {
      point.intensity = point.intensity / maxIntensity;
    });
  }
  
  return points;
}

/**
 * Calculate distribution based on type and parameters
 */
export function calculateDistribution(params: DistributionParams): DistributionPoint[] {
  const { type, lowWavelength, highWavelength } = params;
  
  switch (type) {
    case 'blackbody':
      return calculateBlackbodySpectrum(
        lowWavelength,
        highWavelength,
        params.temperature || 5776
      );
    
    case 'gaussian':
      return calculateGaussianSpectrum(
        lowWavelength,
        highWavelength,
        params.peakWavelength || 300,
        params.standardDeviation || 20,
        params.gaussianMultiplier || 1
      );
    
    case 'lorentzian':
      return calculateLorentzianSpectrum(
        lowWavelength,
        highWavelength,
        params.lorentzianPeakWavelength || 300,
        params.fwhm || 20,
        params.lorentzianMultiplier || 1
      );
    
    default:
      return [];
  }
}

/**
 * Normalize distribution to 0-1 scale
 */
export function normalizeDistribution(points: DistributionPoint[]): DistributionPoint[] {
  if (points.length === 0) return points;
  
  const maxIntensity = Math.max(...points.map(p => p.intensity));
  const minIntensity = Math.min(...points.map(p => p.intensity));
  
  if (maxIntensity === minIntensity) {
    return points.map(p => ({ ...p, intensity: 0.5 }));
  }
  
  return points.map(p => ({
    ...p,
    intensity: (p.intensity - minIntensity) / (maxIntensity - minIntensity)
  }));
}
