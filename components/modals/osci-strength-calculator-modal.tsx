import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColorScheme } from '../../hooks/use-color-scheme';
import { useThemeColor } from '../../hooks/use-theme-color';
import { calculateOscillatorStrength } from '../../lib/oscillator-strength';
import { SelectedSpectrum } from '../../lib/types';
import { ThemedText } from '../themed-text';

const DEFAULT_PARAMS = {
  lowWavelength: 230,
  highWavelength: 300,
  wavelengthForEpsilon: 275,
  epsilon: 770,
};

interface OscillatorStrengthCalculatorModalProps {
  visible: boolean;
  onClose: () => void;
  selectedSpectra: SelectedSpectrum[];
}

export function OscillatorStrengthCalculatorModal({
  visible,
  onClose,
  selectedSpectra,
}: OscillatorStrengthCalculatorModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({}, 'icon');
  const borderColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(128,128,128,0.35)';
  const tintColor = useThemeColor({}, 'tint');
  const primaryButtonTextColor = isDark ? '#11181C' : '#ffffff';
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : undefined;
  const cardBg = useThemeColor({}, 'background');

  const absorptionSpectra = useMemo(
    () => selectedSpectra.filter(s => s.type === 'absorption'),
    [selectedSpectra]
  );

  const [selectedCompoundId, setSelectedCompoundId] = useState<string | null>(null);
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [results, setResults] = useState<{
    oscillatorStrength: number;
    transitionDipoleMomentDebye: number;
    transitionDipoleMomentCm: number;
  } | null>(null);

  const selectedSpectrum = useMemo(() => {
    if (!selectedCompoundId) return null;
    return absorptionSpectra.find(s => s.compound.id === selectedCompoundId) ?? null;
  }, [absorptionSpectra, selectedCompoundId]);

  useEffect(() => {
    if (visible) {
      setSelectedCompoundId(null);
      setParams({ ...DEFAULT_PARAMS });
      setResults(null);
    }
  }, [visible]);

  // Auto-select and auto-fill when only one absorption spectrum
  useEffect(() => {
    if (visible && absorptionSpectra.length === 1) {
      const s = absorptionSpectra[0];
      setSelectedCompoundId(s.compound.id);
      const c = s.compound as { absorption_wavelength?: string; absorption_epsilon?: string };
      const w = parseFloat(c?.absorption_wavelength ?? '');
      const e = parseFloat(c?.absorption_epsilon ?? '');
      if (!isNaN(w) && !isNaN(e) && w > 0 && e > 0) {
        setParams(prev => ({
          ...prev,
          wavelengthForEpsilon: w,
          epsilon: e,
          lowWavelength: Math.max(200, w - 50),
          highWavelength: Math.min(1000, w + 50),
        }));
      }
    }
  }, [visible, absorptionSpectra]);

  const handleCompoundSelect = (compoundId: string) => {
    setSelectedCompoundId(compoundId);
    const s = absorptionSpectra.find(sp => sp.compound.id === compoundId);
    if (s) {
      const c = s.compound as { absorption_wavelength?: string; absorption_epsilon?: string };
      const w = parseFloat(c?.absorption_wavelength ?? '');
      const e = parseFloat(c?.absorption_epsilon ?? '');
      if (!isNaN(w) && !isNaN(e) && w > 0 && e > 0) {
        setParams(prev => ({
          ...prev,
          wavelengthForEpsilon: w,
          epsilon: e,
          lowWavelength: Math.max(200, w - 50),
          highWavelength: Math.min(1000, w + 50),
        }));
      }
    }
  };

  const handleCalculate = () => {
    if (!selectedSpectrum?.data?.length) return;
    const res = calculateOscillatorStrength(selectedSpectrum.data, params);
    if (!res) {
      Alert.alert(
        'Calculation failed',
        'Check your input parameters and ensure there is a clear peak in the specified wavelength range.'
      );
      return;
    }
    setResults(res);
  };

  const updateParam = <K extends keyof typeof params>(key: K, value: number) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.card, { backgroundColor: cardBg, borderColor }]} onPress={() => {}}>
          <View style={[styles.header, { borderBottomColor: borderColor }]}>
            <ThemedText type="subtitle" style={styles.title}>
              Oscillator Strength Calculator
            </ThemedText>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={textColor} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 16 }}>
            <ThemedText style={styles.desc}>
              Calculate oscillator strength and transition dipole moment from absorption spectral data.
            </ThemedText>

            {/* Compound selection */}
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Compound (absorption)</ThemedText>
              {absorptionSpectra.length === 0 ? (
                <ThemedText style={styles.muted}>
                  No absorption spectra selected. Add absorption spectra to the chart first.
                </ThemedText>
              ) : absorptionSpectra.length === 1 ? (
                <View style={[styles.selectedBanner, { borderColor: 'rgba(34,197,94,0.4)' }]}>
                  <ThemedText style={styles.selectedBannerText}>
                    {absorptionSpectra[0].compound.name}
                    {absorptionSpectra[0].compound.database_name
                      ? ` (${absorptionSpectra[0].compound.database_name})`
                      : ''}
                  </ThemedText>
                  {absorptionSpectra[0].compound.absorption_solvent && (
                    <ThemedText style={styles.muted}>
                      Solvent: {String((absorptionSpectra[0].compound as any).absorption_solvent)}
                    </ThemedText>
                  )}
                </View>
              ) : (
                <View style={styles.optionList}>
                  {absorptionSpectra.map(s => (
                    <Pressable
                      key={s.compound.id}
                      style={[
                        styles.optionRow,
                        { borderColor },
                        selectedCompoundId === s.compound.id && {
                          borderColor: tintColor,
                          backgroundColor: 'rgba(128,128,128,0.12)',
                        },
                      ]}
                      onPress={() => handleCompoundSelect(s.compound.id)}
                    >
                      <ThemedText style={styles.optionLabel} numberOfLines={1}>
                        {s.compound.name}
                        {s.compound.database_name ? ` (${s.compound.database_name})` : ''}
                      </ThemedText>
                      {selectedCompoundId === s.compound.id && (
                        <Ionicons name="checkmark-circle" size={20} color={tintColor} />
                      )}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {selectedSpectrum && (
              <>
                {/* Input Parameters */}
                <View style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>Input Parameters</ThemedText>
                  <ParamInput
                    label="Low wavelength (nm)"
                    value={params.lowWavelength}
                    onChange={v => updateParam('lowWavelength', v)}
                    borderColor={borderColor}
                    textColor={textColor}
                    placeholderTextColor={iconColor}
                    inputBg={inputBg}
                  />
                  <ParamInput
                    label="High wavelength (nm)"
                    value={params.highWavelength}
                    onChange={v => updateParam('highWavelength', v)}
                    borderColor={borderColor}
                    textColor={textColor}
                    placeholderTextColor={iconColor}
                    inputBg={inputBg}
                  />
                  <ParamInput
                    label="Wavelength for ε (nm)"
                    value={params.wavelengthForEpsilon}
                    onChange={v => updateParam('wavelengthForEpsilon', v)}
                    borderColor={borderColor}
                    textColor={textColor}
                    placeholderTextColor={iconColor}
                    inputBg={inputBg}
                  />
                  <ParamInput
                    label="ε (M⁻¹cm⁻¹)"
                    value={params.epsilon}
                    onChange={v => updateParam('epsilon', v)}
                    borderColor={borderColor}
                    textColor={textColor}
                    placeholderTextColor={iconColor}
                    inputBg={inputBg}
                  />
                </View>

                <View style={styles.actionsRow}>
                  <Pressable
                    style={[styles.primaryButton, { backgroundColor: tintColor }]}
                    onPress={handleCalculate}
                  >
                    <ThemedText style={[styles.primaryButtonText, { color: primaryButtonTextColor }]}>
                      Calculate
                    </ThemedText>
                  </Pressable>
                  <Pressable style={[styles.secondaryButton, { borderColor: tintColor }]} onPress={onClose}>
                    <ThemedText style={[styles.secondaryButtonText, { color: tintColor }]}>Close</ThemedText>
                  </Pressable>
                </View>

                {/* Results */}
                <View style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>Results</ThemedText>
                  <ResultRow
                    label="Oscillator strength, f"
                    value={results?.oscillatorStrength}
                    format="fix9"
                  />
                  <ResultRow
                    label="μ (Debye)"
                    value={results?.transitionDipoleMomentDebye}
                    format="fix4"
                  />
                  <ResultRow
                    label="μ (C•m)"
                    value={results?.transitionDipoleMomentCm}
                    format="exp"
                  />
                </View>

                <ThemedText style={styles.footnote}>
                  * The algorithm finds the actual peak within the specified wavelength range and
                  calculates the true half-peak width from spectral data.
                </ThemedText>
              </>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ParamInput({
  label,
  value,
  onChange,
  borderColor,
  textColor,
  placeholderTextColor,
  inputBg,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  borderColor: string;
  textColor: string;
  placeholderTextColor: string;
  inputBg: string | undefined;
}) {
  return (
    <View style={styles.paramRow}>
      <ThemedText style={styles.paramLabel}>{label}</ThemedText>
      <TextInput
        style={[styles.input, { borderColor, color: textColor, backgroundColor: inputBg }]}
        placeholderTextColor={placeholderTextColor}
        keyboardType="numeric"
        value={String(value)}
        onChangeText={t => onChange(parseFloat(t) || 0)}
      />
    </View>
  );
}

function ResultRow({
  label,
  value,
  format,
}: {
  label: string;
  value: number | undefined;
  format: 'fix4' | 'fix9' | 'exp';
}) {
  const text =
    value == null
      ? '—'
      : format === 'exp'
        ? value.toExponential(4)
        : format === 'fix9'
          ? value.toFixed(9)
          : value.toFixed(4);
  return (
    <View style={styles.resultRow}>
      <ThemedText style={styles.resultLabel}>{label}</ThemedText>
      <ThemedText style={styles.resultValue}>{text}</ThemedText>
    </View>
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
    maxHeight: '90%',
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
  body: { paddingHorizontal: 16, paddingTop: 12 },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  muted: { fontSize: 13, opacity: 0.7 },
  optionList: { flexDirection: 'column', gap: 8 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  optionLabel: { fontSize: 14, flex: 1 },
  selectedBanner: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: 'rgba(34,197,94,0.08)',
  },
  selectedBannerText: { fontSize: 13, fontWeight: '600' },
  paramRow: { marginBottom: 10 },
  paramLabel: { fontSize: 13, opacity: 0.85, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
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
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  resultLabel: { fontSize: 13, opacity: 0.9 },
  resultValue: { fontSize: 13, fontWeight: '600' },
  footnote: { fontSize: 12, opacity: 0.7, marginTop: 12 },
});
