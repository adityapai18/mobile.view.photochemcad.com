import { AbsorptionData, EmissionData, Compound } from './database';

export interface SpectrumData {
  compound_id: string;
  wavelength: number;
  coefficient?: number;
  normalized?: number;
}

export interface SelectedSpectrum {
  compound: Compound;
  type: 'absorption' | 'emission';
  data: SpectrumData[];
}

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
