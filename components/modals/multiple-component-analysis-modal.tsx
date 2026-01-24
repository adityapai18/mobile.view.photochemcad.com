import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColorScheme } from '../../hooks/use-color-scheme';
import { useThemeColor } from '../../hooks/use-theme-color';
import { getConcentration } from '../../lib/helpers';
import { calculateMultipleComponentAnalysisSimplex, type MCAResults } from '../../lib/mca';
import { SelectedSpectrum } from '../../lib/types';
import { ThemedText } from '../themed-text';

interface ComponentData {
  compound: { id: string; name: string; database_name: string; solvent?: string };
  concentration: number;
  initialFraction: number;
}

const DEFAULT_WAVELENGTHS = [254.75, 260, 261.75, 263];

function getValidSpectraForAnalysis(selectedSpectra: SelectedSpectrum[]): SelectedSpectrum[] {
  if (selectedSpectra.length < 3) return [];
  const absorption = selectedSpectra.filter(s => s.type === 'absorption');
  const emission = selectedSpectra.filter(s => s.type === 'emission');
  if (absorption.length >= 3) return absorption;
  if (emission.length >= 3) return emission;
  return [];
}

interface MultipleComponentAnalysisModalProps {
  visible: boolean;
  onClose: () => void;
  selectedSpectra: SelectedSpectrum[];
}

export function MultipleComponentAnalysisModal({
  visible,
  onClose,
  selectedSpectra,
}: MultipleComponentAnalysisModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({}, 'icon');
  const borderColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(128,128,128,0.35)';
  const tintColor = useThemeColor({}, 'tint');
  const primaryButtonTextColor = isDark ? '#11181C' : '#ffffff';
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : undefined;
  const cardBg = useThemeColor({}, 'background');

  const validSpectra = useMemo(
    () => getValidSpectraForAnalysis(selectedSpectra),
    [selectedSpectra]
  );
  const spectrumType = validSpectra.length > 0 ? validSpectra[0].type : null;
  const componentSpectra = validSpectra.slice(1);
  const absorptionCount = selectedSpectra.filter(s => s.type === 'absorption').length;
  const emissionCount = selectedSpectra.filter(s => s.type === 'emission').length;

  const [selectedWavelengths, setSelectedWavelengths] = useState<number[]>([]);
  const [minWavelength, setMinWavelength] = useState(220);
  const [maxWavelength, setMaxWavelength] = useState(300);
  const [components, setComponents] = useState<ComponentData[]>([]);
  const [results, setResults] = useState<MCAResults | null>(null);
  const [newWavelength, setNewWavelength] = useState('');

  const autoPopulateComponents = useCallback(() => {
    if (validSpectra.length >= 3) {
      setComponents(
        validSpectra.map((s, _, arr) => ({
          compound: s.compound,
          concentration: getConcentration(s),
          initialFraction: 1 / arr.length,
        }))
      );
    } else {
      setComponents([]);
    }
  }, [validSpectra]);

  useEffect(() => {
    if (visible) {
      const fromSpectra = selectedSpectra
        .map(s => Number((s.compound as { absorption_wavelength?: string })?.absorption_wavelength))
        .filter(Number.isFinite);
      setSelectedWavelengths(
        fromSpectra.length > 0 ? [...new Set(fromSpectra)].sort((a, b) => a - b) : [...DEFAULT_WAVELENGTHS]
      );
      setMinWavelength(220);
      setMaxWavelength(300);
      setComponents([]);
      setResults(null);
      setNewWavelength('');
      autoPopulateComponents();
    }
  }, [visible, selectedSpectra, autoPopulateComponents]);

  const handleAddWavelength = () => {
    const w = parseFloat(newWavelength);
    if (Number.isFinite(w) && w > 0 && !selectedWavelengths.includes(w)) {
      setSelectedWavelengths(prev => [...prev, w].sort((a, b) => a - b));
      setNewWavelength('');
    }
  };

  const handleRemoveWavelength = (w: number) => {
    setSelectedWavelengths(prev => prev.filter(x => x !== w));
  };

  const handleComponentChange = (index: number, field: keyof ComponentData, value: number) => {
    setComponents(prev =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  };

  const handleCalculate = () => {
    if (validSpectra.length < 3) {
      Alert.alert(
        'Prerequisites not met',
        'Select at least 3 spectra of the same type (absorption or emission) for multiple component analysis.'
      );
      return;
    }
    if (selectedWavelengths.length === 0) {
      Alert.alert('No wavelengths', 'Add at least one wavelength for analysis.');
      return;
    }
    const componentData = components.slice(1);
    const res = calculateMultipleComponentAnalysisSimplex(validSpectra, {
      selectedWavelengths,
      minWavelength,
      maxWavelength,
      components: componentData,
    });
    if (!res) {
      Alert.alert(
        'Calculation failed',
        'Check input parameters. You need more selected wavelengths than component spectra, and wavelengths must lie within the min–max range.'
      );
      return;
    }
    setResults(res);
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.card, { backgroundColor: cardBg, borderColor }]} onPress={() => {}}>
          <View style={[styles.header, { borderBottomColor: borderColor }]}>
            <ThemedText type="subtitle" style={styles.title}>
              Multiple Component Analysis
            </ThemedText>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={textColor} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
          >
            <ThemedText style={styles.desc}>
              Analyze mixtures: first spectrum = composite, rest = components. Need ≥3 of the same type (all absorption or all emission).
            </ThemedText>

            {validSpectra.length < 3 ? (
              <View style={[styles.prereqBox, { borderColor: 'rgba(202,138,4,0.5)', backgroundColor: 'rgba(202,138,4,0.1)' }]}>
                <ThemedText style={styles.prereqTitle}>Prerequisites not met</ThemedText>
                <ThemedText style={styles.prereqText}>
                  Select at least 3 data files of the same type (absorption or emission) before running MCA.
                </ThemedText>
                <View style={[styles.prereqStats, { borderColor }]}>
                  <ThemedText style={styles.muted}>
                    {selectedSpectra.length} total · {absorptionCount} absorption · {emissionCount} emission
                  </ThemedText>
                </View>
                <ThemedText style={styles.instructions}>
                  1. Open the composite sample spectrum{'\n'}
                  2. Open spectra of the constituent compounds{'\n'}
                  3. Select ≥3 spectra of the same type{'\n'}
                  4. Return here to run analysis
                </ThemedText>
              </View>
            ) : (
              <>
                <View style={[styles.successBanner, { borderColor: 'rgba(34,197,94,0.4)', backgroundColor: 'rgba(34,197,94,0.08)' }]}>
                  <ThemedText style={styles.successText}>
                    ✓ {validSpectra.length} {spectrumType} spectra selected
                  </ThemedText>
                  <ThemedText style={styles.muted}>
                    Composite: {validSpectra[0]?.compound.name} · Components: {componentSpectra.map(s => s.compound.name).join(', ')}
                  </ThemedText>
                </View>

                {/* Wavelength selection */}
                <View style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>Wavelengths (nm)</ThemedText>
                  <View style={[styles.wavelengthList, { borderColor }]}>
                    {selectedWavelengths.length === 0 ? (
                      <ThemedText style={styles.muted}>None. Add below.</ThemedText>
                    ) : (
                      selectedWavelengths.map(w => (
                        <View key={w} style={[styles.wavelengthRow, { borderColor }]}>
                          <ThemedText style={styles.wavelengthValue}>{w}</ThemedText>
                          <TouchableOpacity onPress={() => handleRemoveWavelength(w)} hitSlop={8}>
                            <Ionicons name="close-circle" size={20} color={iconColor} />
                          </TouchableOpacity>
                        </View>
                      ))
                    )}
                  </View>
                  <View style={styles.addRow}>
                    <TextInput
                      style={[styles.input, styles.inputFlex, { borderColor, color: textColor, backgroundColor: inputBg }]}
                      placeholder="e.g. 254.75"
                      placeholderTextColor={iconColor}
                      keyboardType="decimal-pad"
                      value={newWavelength}
                      onChangeText={setNewWavelength}
                    />
                    <Pressable style={[styles.addBtn, { backgroundColor: tintColor }]} onPress={handleAddWavelength}>
                      <Ionicons name="add" size={20} color={primaryButtonTextColor} />
                    </Pressable>
                  </View>
                  <View style={styles.minMaxRow}>
                    <View style={styles.minMaxItem}>
                      <ThemedText style={styles.paramLabel}>Min (nm)</ThemedText>
                      <TextInput
                        style={[styles.input, { borderColor, color: textColor, backgroundColor: inputBg }]}
                        keyboardType="numeric"
                        value={String(minWavelength)}
                        onChangeText={t => setMinWavelength(parseFloat(t) || 0)}
                      />
                    </View>
                    <View style={styles.minMaxItem}>
                      <ThemedText style={styles.paramLabel}>Max (nm)</ThemedText>
                      <TextInput
                        style={[styles.input, { borderColor, color: textColor, backgroundColor: inputBg }]}
                        keyboardType="numeric"
                        value={String(maxWavelength)}
                        onChangeText={t => setMaxWavelength(parseFloat(t) || 0)}
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.actionsRow}>
                  <Pressable
                    style={[styles.primaryButton, { backgroundColor: tintColor }]}
                    onPress={handleCalculate}
                  >
                    <ThemedText style={[styles.primaryButtonText, { color: primaryButtonTextColor }]}>
                      Run Analysis
                    </ThemedText>
                  </Pressable>
                  <Pressable style={[styles.secondaryButton, { borderColor: tintColor }]} onPress={onClose}>
                    <ThemedText style={[styles.secondaryButtonText, { color: tintColor }]}>Close</ThemedText>
                  </Pressable>
                </View>

                {/* Component table */}
                <View style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>Component data</ThemedText>
                  {components.length === 0 ? (
                    <ThemedText style={styles.muted}>No components. Need ≥3 spectra of the same type.</ThemedText>
                  ) : (
                    <View style={[styles.table, { borderColor }]}>
                      {components.map((comp, i) => {
                        const match = results?.components?.find(r => r.compound.id === comp.compound.id);
                        const isComposite = i === 0;
                        return (
                          <View key={comp.compound.id} style={[styles.tableRow, { borderColor }]}>
                            <View style={styles.tableCell}>
                              <ThemedText style={styles.compoundName} numberOfLines={1}>
                                {comp.compound.name}
                              </ThemedText>
                            </View>
                            <View style={styles.tableCell}>
                              <ThemedText style={styles.tableLabel}>Conc (µM)</ThemedText>
                              <TextInput
                                style={[styles.inputSmall, { borderColor, color: textColor, backgroundColor: inputBg }]}
                                keyboardType="decimal-pad"
                                value={comp.concentration.toFixed(2)}
                                onChangeText={t => handleComponentChange(i, 'concentration', parseFloat(t) || 0)}
                                editable={!isComposite}
                              />
                            </View>
                            <View style={styles.tableCell}>
                              <ThemedText style={styles.tableLabel}>Initial frac.</ThemedText>
                              <TextInput
                                style={[styles.inputSmall, { borderColor, color: textColor, backgroundColor: inputBg }]}
                                keyboardType="decimal-pad"
                                value={comp.initialFraction.toFixed(2)}
                                onChangeText={t => handleComponentChange(i, 'initialFraction', parseFloat(t) || 0)}
                                editable={!isComposite}
                              />
                            </View>
                            <View style={styles.tableCell}>
                              <ThemedText style={styles.tableLabel}>Actual frac.</ThemedText>
                              <ThemedText style={styles.resultValue}>{match?.actualFraction?.toFixed(4) ?? '—'}</ThemedText>
                            </View>
                            <View style={styles.tableCell}>
                              <ThemedText style={styles.tableLabel}>Actual conc. (µM)</ThemedText>
                              <ThemedText style={styles.resultValue}>{match?.actualConcentration?.toFixed(2) ?? '—'}</ThemedText>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>

                {/* Overall fit */}
                {results && (
                  <View style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>Overall fit</ThemedText>
                    <View style={[styles.fitRow, { borderColor }]}>
                      <ThemedText style={styles.fitLabel}>R²</ThemedText>
                      <ThemedText style={styles.fitValue}>{results.overallFit.rSquared.toFixed(4)}</ThemedText>
                    </View>
                    <View style={[styles.fitRow, { borderColor }]}>
                      <ThemedText style={styles.fitLabel}>Mean residual</ThemedText>
                      <ThemedText style={styles.fitValue}>{results.overallFit.meanResidual.toFixed(4)}</ThemedText>
                    </View>
                    <View style={[styles.fitRow, { borderColor }]}>
                      <ThemedText style={styles.fitLabel}>Max residual</ThemedText>
                      <ThemedText style={styles.fitValue}>{results.overallFit.maxResidual.toFixed(4)}</ThemedText>
                    </View>
                  </View>
                )}

                {/* Wavelength results */}
                {results && results.wavelengthResults.length > 0 && (
                  <View style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>Wavelength results</ThemedText>
                    <View style={[styles.wavelengthResultsList, { borderColor }]}>
                      {results.wavelengthResults.slice(0, 12).map(wr => (
                        <View key={wr.wavelength} style={[styles.wrRow, { borderColor }]}>
                          <ThemedText style={styles.wrWave}>{wr.wavelength} nm</ThemedText>
                          <ThemedText style={styles.muted}>
                            calc: {wr.calculatedAbsorbance.toFixed(3)} · exp: {wr.experimentalAbsorbance.toFixed(3)} · res: {wr.residual.toFixed(3)}
                          </ThemedText>
                        </View>
                      ))}
                      {results.wavelengthResults.length > 12 && (
                        <ThemedText style={styles.muted}>+{results.wavelengthResults.length - 12} more</ThemedText>
                      )}
                    </View>
                  </View>
                )}

                <ThemedText style={styles.footnote}>
                  The first selected spectrum is the composite; the rest are the constituent components.
                </ThemedText>
              </>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    height: '90%',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  title: { fontSize: 16, fontWeight: '700' },
  desc: { fontSize: 13, opacity: 0.8, marginBottom: 12 },
  body: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  bodyContent: { paddingBottom: 16 },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  muted: { fontSize: 13, opacity: 0.7 },
  prereqBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  prereqTitle: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
  prereqText: { fontSize: 13, marginBottom: 12 },
  prereqStats: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  instructions: { fontSize: 12, opacity: 0.85, lineHeight: 18 },
  successBanner: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  successText: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  wavelengthList: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    maxHeight: 120,
  },
  wavelengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
  },
  wavelengthValue: { fontSize: 13 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  inputFlex: { flex: 1 },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  minMaxRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  minMaxItem: { flex: 1 },
  paramLabel: { fontSize: 12, opacity: 0.85, marginBottom: 4 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  primaryButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { fontSize: 14, fontWeight: '600' },
  secondaryButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: { fontSize: 14, fontWeight: '500' },
  table: { borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  tableRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  tableCell: { minWidth: 80 },
  tableLabel: { fontSize: 11, opacity: 0.8, marginBottom: 2 },
  compoundName: { fontSize: 13, fontWeight: '500' },
  inputSmall: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6, fontSize: 13 },
  resultValue: { fontSize: 13, fontWeight: '600' },
  fitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  fitLabel: { fontSize: 13 },
  fitValue: { fontSize: 13, fontWeight: '600' },
  wavelengthResultsList: { borderWidth: 1, borderRadius: 8, padding: 8, maxHeight: 200 },
  wrRow: { paddingVertical: 6, borderBottomWidth: 1 },
  wrWave: { fontSize: 13, fontWeight: '500' },
  footnote: { fontSize: 12, opacity: 0.7, marginTop: 12 },
});
