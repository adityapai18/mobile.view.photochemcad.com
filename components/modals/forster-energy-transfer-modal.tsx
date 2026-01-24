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
  calculateForsterEnergyTransfer,
  type ForsterEnergyTransferParams,
  type ForsterEnergyTransferResults,
} from '../../lib/forster-energy-transfer';
import { ThemedText } from '../themed-text';

const DEFAULT_PARAMS: ForsterEnergyTransferParams = {
  refractiveIndex: 1.5,
  orientationFactor: 1,
  fluorescenceLifetime: 0,
  distance: 0.1,
  donorQuantumYield: 0.17,
  acceptorEpsilon: 210,
  wavelengthForEpsilon: 254.75,
  lowWavelength: 220,
  highWavelength: 300,
};

interface ForsterEnergyTransferModalProps {
  visible: boolean;
  onClose: () => void;
  selectedSpectra: SelectedSpectrum[];
}

export function ForsterEnergyTransferModal({
  visible,
  onClose,
  selectedSpectra,
}: ForsterEnergyTransferModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({}, 'icon');
  const borderColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(128,128,128,0.35)';
  const tintColor = useThemeColor({}, 'tint');
  const primaryButtonTextColor = isDark ? '#11181C' : '#ffffff';
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : undefined;
  const cardBg = useThemeColor({}, 'background');

  const [donorId, setDonorId] = useState<string | null>(null);
  const [acceptorId, setAcceptorId] = useState<string | null>(null);
  const [params, setParams] = useState<ForsterEnergyTransferParams>(DEFAULT_PARAMS);
  const [results, setResults] = useState<ForsterEnergyTransferResults | null>(null);

  const emissionSpectra = useMemo(
    () => selectedSpectra.filter(s => s.type === 'emission'),
    [selectedSpectra]
  );
  const absorptionSpectra = useMemo(
    () => selectedSpectra.filter(s => s.type === 'absorption'),
    [selectedSpectra]
  );

  const donorSpectrum = useMemo(
    () => emissionSpectra.find(s => s.compound.id === donorId) ?? null,
    [emissionSpectra, donorId]
  );
  const acceptorSpectrum = useMemo(
    () => absorptionSpectra.find(s => s.compound.id === acceptorId) ?? null,
    [absorptionSpectra, acceptorId]
  );

  useEffect(() => {
    if (visible) {
      setDonorId(null);
      setAcceptorId(null);
      setParams({ ...DEFAULT_PARAMS });
      setResults(null);
    }
  }, [visible]);

  const handleAcceptorSelect = (compoundId: string) => {
    const spectrum = absorptionSpectra.find(s => s.compound.id === compoundId);
    setAcceptorId(compoundId);
    if (spectrum) {
      const c = spectrum.compound as any;
      const w = parseFloat(c?.absorption_wavelength);
      const e = parseFloat(c?.absorption_epsilon);
      if (!isNaN(w) && !isNaN(e) && w > 0 && e > 0) {
        setParams(prev => ({
          ...prev,
          wavelengthForEpsilon: w,
          acceptorEpsilon: e,
        }));
      }
    }
  };

  const handleCalculate = () => {
    if (!donorSpectrum?.data?.length || !acceptorSpectrum?.data?.length) {
      console.warn('Select both donor (emission) and acceptor (absorption) spectra.');
      return;
    }
    const res = calculateForsterEnergyTransfer(
      donorSpectrum.data,
      acceptorSpectrum.data,
      params
    );
    if (!res) {
      console.warn('Calculation failed. Check input parameters and spectral overlap.');
      return;
    }
    setResults(res);
  };

  const updateParam = <K extends keyof ForsterEnergyTransferParams>(
    key: K,
    value: number
  ) => {
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
              Forster Energy Transfer Calculator
            </ThemedText>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={textColor} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 16 }}>
            <ThemedText style={styles.desc}>
              Donor emission and acceptor absorption spectra with spectral overlap.
            </ThemedText>

            {/* Donor (Emission) */}
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Donor (Emission spectrum)</ThemedText>
              {emissionSpectra.length === 0 ? (
                <ThemedText style={styles.muted}>No emission spectra selected.</ThemedText>
              ) : (
                <View style={styles.optionList}>
                  {emissionSpectra.map(s => (
                    <Pressable
                      key={s.compound.id}
                      style={[
                        styles.optionRow,
                        { borderColor },
                        donorId === s.compound.id && { borderColor: tintColor, backgroundColor: 'rgba(128,128,128,0.12)' },
                      ]}
                      onPress={() => setDonorId(s.compound.id)}
                    >
                      <ThemedText style={styles.optionLabel} numberOfLines={1}>
                        {s.compound.name}
                        {s.compound.database_name ? ` (${s.compound.database_name})` : ''}
                      </ThemedText>
                      {donorId === s.compound.id && (
                        <Ionicons name="checkmark-circle" size={20} color={tintColor} />
                      )}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Acceptor (Absorption) */}
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Acceptor (Absorption spectrum)</ThemedText>
              {absorptionSpectra.length === 0 ? (
                <ThemedText style={styles.muted}>No absorption spectra selected.</ThemedText>
              ) : (
                <View style={styles.optionList}>
                  {absorptionSpectra.map(s => (
                    <Pressable
                      key={s.compound.id}
                      style={[
                        styles.optionRow,
                        { borderColor },
                        acceptorId === s.compound.id && { borderColor: tintColor, backgroundColor: 'rgba(128,128,128,0.12)' },
                      ]}
                      onPress={() => handleAcceptorSelect(s.compound.id)}
                    >
                      <ThemedText style={styles.optionLabel} numberOfLines={1}>
                        {s.compound.name}
                        {s.compound.database_name ? ` (${s.compound.database_name})` : ''}
                      </ThemedText>
                      {acceptorId === s.compound.id && (
                        <Ionicons name="checkmark-circle" size={20} color={tintColor} />
                      )}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {donorSpectrum && acceptorSpectrum && (
              <>
                {/* Input Parameters */}
                <View style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>Input Parameters</ThemedText>
                  <ParamInput
                    label="Refractive index (1–4)"
                    value={params.refractiveIndex}
                    onChange={v => updateParam('refractiveIndex', v)}
                    borderColor={borderColor}
                    textColor={textColor}
                    placeholderTextColor={iconColor}
                    inputBg={inputBg}
                  />
                  <ParamInput
                    label="Orientation factor κ² (0–4)"
                    value={params.orientationFactor}
                    onChange={v => updateParam('orientationFactor', v)}
                    borderColor={borderColor}
                    textColor={textColor}
                    placeholderTextColor={iconColor}
                    inputBg={inputBg}
                  />
                  <ParamInput
                    label="Fluorescence lifetime (ns)"
                    value={params.fluorescenceLifetime}
                    onChange={v => updateParam('fluorescenceLifetime', v)}
                    borderColor={borderColor}
                    textColor={textColor}
                    placeholderTextColor={iconColor}
                    inputBg={inputBg}
                  />
                  <ParamInput
                    label="Distance (Å)"
                    value={params.distance}
                    onChange={v => updateParam('distance', v)}
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
                    label="Donor quantum yield (0–1)"
                    value={params.donorQuantumYield}
                    onChange={v => updateParam('donorQuantumYield', v)}
                    borderColor={borderColor}
                    textColor={textColor}
                    placeholderTextColor={iconColor}
                    inputBg={inputBg}
                  />
                  <ParamInput
                    label="Acceptor ε (M⁻¹cm⁻¹)"
                    value={params.acceptorEpsilon}
                    onChange={v => updateParam('acceptorEpsilon', v)}
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
                </View>

                {/* Actions */}
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
                  <ResultRow label="J (cm⁶mmol⁻¹)" value={results?.jValue} format="exp9" />
                  <ResultRow label="Förster distance (Å)" value={results?.forsterDistance} format="fix" />
                  <ResultRow label="Transfer efficiency (%)" value={results?.transferEfficiency} format="pct" />
                  <ResultRow label="Rate k_trans (s⁻¹)" value={results?.rateOfEnergyTransfer} format="exp" />
                  <ResultRow label="Dexter (eV⁻¹)" value={results?.dexterValue} format="exp" />
                </View>

                <ThemedText style={styles.footnote}>
                  * Spectral overlap between donor emission and acceptor absorption is required.
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
  format: 'exp' | 'exp9' | 'fix' | 'pct';
}) {
  const text =
    value == null
      ? '—'
      : format === 'exp'
        ? value.toExponential(4)
        : format === 'exp9'
          ? value.toExponential(9)
          : format === 'pct'
            ? value.toFixed(2)
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
