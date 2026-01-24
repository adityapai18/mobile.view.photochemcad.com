import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColor } from '../../hooks/use-theme-color';
import { Compound, getAbsorptionData, getEmissionData } from '../../lib/database';
import { DistributionParams, SelectedSpectrum } from '../../lib/types';
import { DatabaseBrowser } from '../database-browser';
import { DistributionModal } from '../modals/distribution-modal';
import { EnergyTransferModal } from '../modals/energy-transfer-modal';
import { ForsterEnergyTransferModal } from '../modals/forster-energy-transfer-modal';
import { MultipleComponentAnalysisModal } from '../modals/multiple-component-analysis-modal';
import { NaturalRadiativeLifetimeModal } from '../modals/natural-radiative-lifetime-modal';
import { OscillatorStrengthCalculatorModal } from '../modals/osci-strength-calculator-modal';
import { SpectrumChart } from '../spectrum-chart';
import { ThemedText } from '../themed-text';
import { ThemedView } from '../themed-view';

interface SpectrumDashboardProps {
  databases?: { name: string; count: number }[];
}

type CalculationModuleId =
  | 'oscillator-strength'
  | 'forster-energy-transfer'
  | 'energy-transfer-simulation'
  | 'natural-radiative-lifetime'
  | 'multiple-component-analysis';

const CALCULATION_MODULES: { id: CalculationModuleId; title: string }[] = [
  { id: 'oscillator-strength', title: 'Oscillator Strength Calculator' },
  { id: 'forster-energy-transfer', title: 'Forster Energy Transfer Calculator' },
  { id: 'energy-transfer-simulation', title: 'Energy Transfer Simulation' },
  { id: 'natural-radiative-lifetime', title: 'Natural Radiative Lifetime Calculator' },
  { id: 'multiple-component-analysis', title: 'Multiple Component Analysis' },
];

export function SpectrumDashboard({ databases = [] }: SpectrumDashboardProps) {
  const [selectedSpectra, setSelectedSpectra] = useState<SelectedSpectrum[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({}, 'icon');
  const tintColor = useThemeColor({}, 'tint');

  const [isModulePickerOpen, setIsModulePickerOpen] = useState(false);
  const [activeModuleId, setActiveModuleId] = useState<CalculationModuleId | null>(null);
  const [isDistributionModalOpen, setIsDistributionModalOpen] = useState(false);
  const [distributions, setDistributions] = useState<DistributionParams[]>([]);

  const activeModule = useMemo(
    () => (activeModuleId ? CALCULATION_MODULES.find(m => m.id === activeModuleId) ?? null : null),
    [activeModuleId]
  );

  const handleSpectrumAdd = async (spectrum: { compound: Compound; type: 'absorption' | 'emission' }) => {
    // Check if already selected
    const exists = selectedSpectra.some(
      s => s.compound.id === spectrum.compound.id && s.type === spectrum.type
    );
    if (exists) {
      console.log('Spectrum already selected:', spectrum.compound.name, spectrum.type);
      return;
    }

    console.log('Adding spectrum:', spectrum.compound.name, spectrum.type);
    setIsLoading(true);
    try {
      // Fetch spectrum data
      let data;
      if (spectrum.type === 'absorption') {
        data = await getAbsorptionData(spectrum.compound.id);
        console.log('Absorption data fetched:', data?.length, 'points');
      } else {
        data = await getEmissionData(spectrum.compound.id);
        console.log('Emission data fetched:', data?.length, 'points');
      }

      if (data && data.length > 0) {
        // Transform data to match SpectrumData interface
        const spectrumData = data.map((point: any) => ({
          compound_id: point.compound_id,
          wavelength: point.wavelength,
          coefficient: 'coefficient' in point ? point.coefficient : undefined,
          normalized: 'normalized' in point ? point.normalized : undefined,
        }));

        const newSpectrum = {
          compound: spectrum.compound,
          type: spectrum.type,
          data: spectrumData,
        };

        setSelectedSpectra(prev => {
          const updated = [...prev, newSpectrum];
          console.log('Updated selectedSpectra, count:', updated.length);
          return updated;
        });
      } else {
        console.warn('No data returned for spectrum:', spectrum.compound.name, spectrum.type);
      }
    } catch (error) {
      console.error('Error loading spectrum data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpectrumRemove = (compoundId: string, type: 'absorption' | 'emission') => {
    setSelectedSpectra(prev =>
      prev.filter(
        s => !(s.compound.id === compoundId && s.type === type)
      )
    );
  };

  // Prepare data for FlatList - each section is an item
  const listData = useMemo(() => [
    { id: 'browser', type: 'browser' as const },
    { id: 'selected', type: 'selected' as const },
    { id: 'modules', type: 'modules' as const },
    { id: 'chart', type: 'chart' as const },
  ], []);

  const renderHeader = () => (
    <ThemedView style={styles.header}>
      <View>
        <View style={styles.titleContainer}>
          <View style={styles.titleLine} />
          <View>
            <ThemedText type="title" style={styles.title}>Spectrum Comparison Dashboard</ThemedText>
            <ThemedText style={styles.subtitle}>
              Compare absorption and emission spectra from the PhotochemCAD database
            </ThemedText>
          </View>
        </View>
      </View>
    </ThemedView>
  );

  const renderItem = ({ item }: { item: { id: string; type: 'browser' | 'chart' | 'selected' | 'modules' } }) => {
    if (item.type === 'browser') {
      return (
        <View style={styles.browserContainer}>
          <DatabaseBrowser
            databases={databases}
            onSpectrumAdd={handleSpectrumAdd}
            onSpectrumRemove={handleSpectrumRemove}
            selectedSpectra={selectedSpectra}
          />
        </View>
      );
    }

    if (item.type === 'selected') {
      return (
        <View style={styles.selectedContainer}>
          <ThemedText type="subtitle" style={styles.selectedTitle}>
            Selected Spectra ({selectedSpectra.length}) 
          </ThemedText>
          {selectedSpectra.length === 0 ? (
            <ThemedText style={styles.emptySelectedText}>
              No spectra selected. Click Abs or Em buttons to add spectra.
            </ThemedText>
          ) : (
            <View style={styles.selectedList}>
              {selectedSpectra.map((item) => (
                <View key={`${item.compound.id}-${item.type}`} style={styles.selectedItem}>
                  <View style={styles.selectedItemContent}>
                    <ThemedText style={styles.selectedCompoundName}>
                      {item.compound.name}
                    </ThemedText>
                    <ThemedText style={styles.selectedType} numberOfLines={1}>
                      {item.type === 'absorption' ? 'Abs' : 'Em'}
                    </ThemedText>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleSpectrumRemove(item.compound.id, item.type)}
                    style={styles.removeButton}
                  >
                    <ThemedText style={styles.removeText}>×</ThemedText>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      );
    }

    if (item.type === 'modules') {
      return (
        <View style={styles.modulesContainer}>
          <View style={styles.modulesRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setIsDistributionModalOpen(true)}
              style={styles.manageButton}
            >
              <Ionicons name="settings-outline" size={18} color={textColor} />
              <ThemedText style={styles.manageButtonText}>
                Distributions{distributions.length > 0 ? ` (${distributions.length})` : ''}
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setIsModulePickerOpen(true)}
              style={styles.selectModule}
            >
              <ThemedText style={styles.selectModuleText}>Calculation modules</ThemedText>
              <Ionicons name="chevron-down" size={18} color={iconColor} />
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (item.type === 'chart') {
      return (
        <View style={styles.chartContainer}>
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#3b82f6" />
            </View>
          )}
          <SpectrumChart
            data={selectedSpectra}
            isLoading={isLoading}
            distributions={distributions}
          />
        </View>
      );
    }

    return null;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
        style={{ backgroundColor }}
        scrollEnabled={true}
        removeClippedSubviews={false}
        extraData={[selectedSpectra.length, distributions.length]}
      />

      {/* Module picker (UI only) */}
      <Modal
        transparent
        visible={isModulePickerOpen}
        animationType="fade"
        onRequestClose={() => setIsModulePickerOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setIsModulePickerOpen(false)}>
          <Pressable style={[styles.pickerCard, { backgroundColor }]} onPress={() => {}}>
            <ThemedText style={styles.pickerTitle}>Calculation modules</ThemedText>
            <View style={styles.pickerList}>
              {CALCULATION_MODULES.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  activeOpacity={0.85}
                  style={styles.pickerItem}
                  onPress={() => {
                    setIsModulePickerOpen(false);
                    setActiveModuleId(m.id);
                  }}
                >
                  <ThemedText style={styles.pickerItemText}>{m.title}</ThemedText>
                  <Ionicons name="chevron-forward" size={18} color={iconColor} />
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Distribution modal */}
      <DistributionModal
        visible={isDistributionModalOpen}
        onClose={() => setIsDistributionModalOpen(false)}
        distributions={distributions}
        onDistributionsChange={setDistributions}
      />

      {/* Energy Transfer modal */}
      <EnergyTransferModal
        visible={activeModuleId === 'energy-transfer-simulation'}
        onClose={() => setActiveModuleId(null)}
        selectedSpectra={selectedSpectra}
      />

      {/* Forster Energy Transfer modal */}
      <ForsterEnergyTransferModal
        visible={activeModuleId === 'forster-energy-transfer'}
        onClose={() => setActiveModuleId(null)}
        selectedSpectra={selectedSpectra}
      />

      {/* Natural Radiative Lifetime modal */}
      <NaturalRadiativeLifetimeModal
        visible={activeModuleId === 'natural-radiative-lifetime'}
        onClose={() => setActiveModuleId(null)}
        selectedSpectra={selectedSpectra}
      />

      {/* Oscillator Strength Calculator modal */}
      <OscillatorStrengthCalculatorModal
        visible={activeModuleId === 'oscillator-strength'}
        onClose={() => setActiveModuleId(null)}
        selectedSpectra={selectedSpectra}
      />

      {/* Multiple Component Analysis modal */}
      <MultipleComponentAnalysisModal
        visible={activeModuleId === 'multiple-component-analysis'}
        onClose={() => setActiveModuleId(null)}
        selectedSpectra={selectedSpectra}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  titleLine: {
    width: 4,
    backgroundColor: '#3b82f6',
    marginRight: 12,
    borderRadius: 2,
  },
  title: {
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  content: {
    padding: 16,
  },
  browserContainer: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  selectedContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  modulesContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  modulesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.35)',
    backgroundColor: 'rgba(128, 128, 128, 0.10)',
  },
  manageButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  selectModule: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.35)',
    backgroundColor: 'rgba(128, 128, 128, 0.10)',
  },
  selectModuleText: {
    fontSize: 15,
    opacity: 0.75,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 16,
    justifyContent: 'center',
  },
  pickerCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.25)',
    overflow: 'hidden',
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  pickerList: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.15)',
  },
  pickerItemText: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    paddingRight: 12,
  },
  moduleHeader: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  moduleBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 6,
    alignSelf: 'flex-start',
  },
  moduleBackText: {
    fontSize: 15,
    fontWeight: '700',
  },
  moduleBody: {
    padding: 16,
  },
  moduleTitle: {
    marginBottom: 6,
  },
  moduleSubtitle: {
    opacity: 0.75,
    marginBottom: 16,
  },
  modulePlaceholderCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.25)',
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
    padding: 16,
  },
  modulePlaceholderTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  modulePlaceholderText: {
    fontSize: 13,
    opacity: 0.85,
    lineHeight: 18,
  },
  selectedTitle: {
    marginBottom: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  selectedList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  selectedItemContent: {
    marginRight: 6,
  },
  selectedCompoundName: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  selectedType: {
    fontSize: 11,
    opacity: 0.7,
  },
  emptySelectedText: {
    fontSize: 12,
    opacity: 0.6,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  removeButton: {
    padding: 2,
  },
  removeText: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: 'bold',
  },
  chartContainer: {
    position: 'relative',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderRadius: 8,
  },
});
