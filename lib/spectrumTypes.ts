interface SpectrumData {
  compound_id: string;
  wavelength: number;
  coefficient?: number;
  normalized?: number;
}

interface Compound {
  // Basic identification
  id: string;
  id_prefix?: string;
  numeric_id?: number;
  name: string;
  slug: string;
  cas?: string;
  
  // Database and category information
  database_id?: number;
  category_id?: string;
  database_name: string;
  database_slug?: string;
  category_name: string;
  class_name?: string;
  synonym?: string;
  
  // Chemical properties
  chemical_formula?: string;
  molecular_weight?: number;
  
  // Source information
  source_name?: string;
  source_url?: string;
  
  // Absorption data
  absorption_wavelength?: string;
  absorption_epsilon?: string;
  absorption_coefficient?: string;
  absorption_solvent?: string;
  absorption_instrument?: string;
  absorption_reference_epsilon?: string;
  absorption_reference?: string;
  absorption_date?: string;
  absorption_by?: string;
  
  // Emission data
  emission_wavelength?: string;
  emission_fluorescence_peaks?: string;
  emission_quantum_yield?: number;
  emission_reference_quantum_yield?: number;
  emission_solvent?: string;
  emission_instrument?: string;
  emission_reference?: string;
  emission_date?: string;
  emission_by?: string;
  
  // Data availability flags
  has_structure_tif?: string;
  has_structure_png?: string;
  has_absorption_data: string;
  has_absorption_tif?: string;
  has_emission_data: string;
  has_emission_tif?: string;
  has_structure_labeled_tif?: string;
  has_structure_labeled_png?: string;
  has_structure_cdx?: string;
}

interface SelectedSpectrum {
  compound: Compound;
  type: 'absorption' | 'emission';
  data: SpectrumData[];
}

interface SpectrumDashboardProps {
  selectedSpectra?: SelectedSpectrum[];
}