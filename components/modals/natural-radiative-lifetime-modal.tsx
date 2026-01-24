import React, { useEffect, useMemo, useState } from 'react';
import {
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
import { SelectedSpectrum } from '../../lib/types';
import {
  calculateNaturalRadiativeLifetime,
  type NaturalRadiativeLifetimeParams,
  type NaturalRadiativeLifetimeResults,
} from '../../lib/natural-radiative-lifetime';
import { ThemedText } from '../themed-text';

const DEFAULT_PARAMS: NaturalRadiativeLifetimeParams = {
  lowWavelength: 220,
  highWavelength: 300,
  refractiveIndex: 1,
  epsilon: 210,
  wavelengthForEpsilon: 254.75,
  quantumYield: 0.053,
};

interface NaturalRadiativeLifetimeModalProps {
  visible: boolean;
  onClose: () => void;
  selectedSpectra: SelectedSpectrum[];
}

export function NaturalRadiativeLifetimeModal({
  visible,
  onClose,
  selectedSpectra,
}: NaturalRadiativeLifetimeModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({}, 'icon');
  const borderColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(128,128,128,0.35)';
  const tintColor = useThemeColor({}, 'tint');
  const primaryButtonTextColor = isDark ? '#11181C' : '#ffffff';
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : undefined;
  const cardBg = useThemeColor({}, 'background');

  const [selectedCompoundId, setSelectedCompoundId] = useState<string | null>(null);
  const [params, setParams] = useState<NaturalRadiativeLifetimeParams>(DEFAULT_PARAMS);
  const [results, setResults] = useState<NaturalRadiativeLifetimeResults | null>(null);

  const validCompounds = useMemo(() => {
    const byId: Record<
      string,
      { compound: SelectedSpectrum['compound']; hasEmission: boolean; hasAbsorption: boolean }
    > = {};
    for (const s of selectedSpectra) {
      const id = s.compound.id;
      if (!byId[id]) {
        byId[id] = { compound: s.compound, hasEmission: false, hasAbsorption: false };
      }
      if (s.type === 'emission') byId[id].hasEmission = true;
      if (s.type === 'absorption') byId[id].hasAbsorption = true;
    }
    return Object.values(byId).filter(c => c.hasEmission && c.hasAbsorption);
  }, [selectedSpectra]);

  const emissionSpectrum = useMemo(() => {
    if (!selectedCompoundId) return null;
    return selectedSpectra.find(
      s => s.compound.id === selectedCompoundId && s.type === 'emission'
    )?.data ?? null;
  }, [selectedSpectra, selectedCompoundId]);

  const absorptionSpectrum = useMemo(() => {
    if (!selectedCompoundId) return null;
    return selectedSpectra.find(
      s => s.compound.id === selectedCompoundId && s.type === 'absorption'
    )?.data ?? null;
  }, [selectedSpectra, selectedCompoundId]);

  const selectedCompound = useMemo(
    () => validCompounds.find(c => c.compound.id === selectedCompoundId)?.compound ?? null,
    [validCompounds, selectedCompoundId]
  );

  useEffect(() => {
    if (visible) {
      setSelectedCompoundId(null);
      setParams({ ...DEFAULT_PARAMS });
      setResults(null);
    }
  }, [visible]);

  const handleCompoundSelect = (compoundId: string) => {
    setSelectedCompoundId(compoundId);
    const absorption = selectedSpectra.find(
      s => s.compound.id === compoundId && s.type === 'absorption'
    );
    if (absorption) {
      const c = absorption.compound as any;
      const w = parseFloat(c?.absorption_wavelength);
      const e = parseFloat(c?.absorption_epsilon);
      if (!isNaN(w) && !isNaN(e) && w > 0 && e > 0) {
        setParams(prev => ({
          ...prev,
          wavelengthForEpsilon: w,
          epsilon: e,
        }));
      }
    }
  };

  const handleCalculate = () => {
    if (!emissionSpectrum?.length || !absorptionSpectrum?.length) {
      console.warn('Select a compound with both emission and absorption spectra.');
      return;
    }
    const res = calculateNaturalRadiativeLifetime(
      emissionSpectrum,
      absorptionSpectrum,
      params
    );
    if (!res) {
      console.warn('Calculation failed. Check parameters and spectra.');
      return;
    }
    setResults(res);
  };

  const updateParam = <K extends keyof NaturalRadiativeLifetimeParams>(key: K, value: number) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.card, { backgroundColor: cardBg, borderColor }]}
          onPress={() => {}}
        >
          <View style={[styles.header, { borderBottomColor: borderColor }]}>
            <ThemedText type="subtitle" style={styles.title}>
              Natural Radiative Lifetime Calculator
            </ThemedText>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={textColor} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 16 }}>
            <ThemedText style={styles.desc}>
              Strickler–Berg: select a compound with both emission and absorption spectra.
            </ThemedText>

            {/* Compound selection */}
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>
                Compound (emission + absorption)
              </ThemedText>
              {validCompounds.length === 0 ? (
                <ThemedText style={styles.muted}>
                  No compound with both spectra. Add emission and absorption for the same compound.
                </ThemedText>
              ) : (
                <View style={styles.optionList}>
                  {validCompounds.map(({ compound }) => (
                    <Pressable
                      key={compound.id}
                      style={[
                        styles.optionRow,
                        { borderColor },
                        selectedCompoundId === compound.id && {
                          borderColor: tintColor,
                          backgroundColor: 'rgba(128,128,128,0.12)',
                        },
                      ]}
                      onPress={() => handleCompoundSelect(compound.id)}
                    >
                      <ThemedText style={styles.optionLabel} numberOfLines={1}>
                        {compound.name}
                        {compound.database_name ? ` (${compound.database_name})` : ''}
                      </ThemedText>
                      {selectedCompoundId === compound.id && (
                        <Ionicons name="checkmark-circle" size={20} color={tintColor} />
                      )}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {selectedCompound && (
              <>
                <View style={[styles.selectedBanner, { borderColor: 'rgba(34,197,94,0.4)' }]}>
                  <ThemedText style={styles.selectedBannerText}>
                    ✓ {selectedCompound.name} — emission and absorption available
                  </ThemedText>
                </View>

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
                    label="Refractive index, n"
                    value={params.refractiveIndex}
                    onChange={v => updateParam('refractiveIndex', v)}
                    borderColor={borderColor}
                    textColor={textColor}
                    placeholderTextColor={iconColor}
                    inputBg={inputBg}
                  />
                </View>

                {/* Database Parameters */}
                <View style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>Database Parameters</ThemedText>
                  <ParamInput
                    label="ε (M⁻¹cm⁻¹)"
                    value={params.epsilon}
                    onChange={v => updateParam('epsilon', v)}
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
                    label="Quantum yield Φf (0–1)"
                    value={params.quantumYield}
                    onChange={v => updateParam('quantumYield', v)}
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
                    <ThemedText style={[styles.secondaryButtonText, { color: tintColor }]}>
                      Close
                    </ThemedText>
                  </Pressable>
                </View>

                {/* Results */}
                <View style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>Results</ThemedText>
                  <ResultRow label="∫ε d ln ν" value={results?.integralTerm} format="fix5" />
                  <ResultRow label="<ν⁻³>⁻¹" value={results?.meanValue} format="exp" />
                  <ResultRow label="τ₀ (ns)" value={results?.naturalRadiativeLifetime} format="fix4" />
                  <ResultRow label="k_f (s⁻¹)" value={results?.transitionRate} format="fix0" />
                  <ResultRow label="τ (ns)" value={results?.actualFluorescenceLifetime} format="fix4" />
                </View>

                <ThemedText style={styles.footnote}>
                  * Requires both emission and absorption spectra from the same compound.
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
  format: 'fix0' | 'fix4' | 'fix5' | 'exp';
}) {
  const text =
    value == null
      ? '—'
      : format === 'exp'
        ? value.toExponential(4)
        : format === 'fix0'
          ? value.toFixed(0)
          : format === 'fix4'
            ? value.toFixed(4)
            : value.toFixed(5);
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
    marginTop: 8,
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
