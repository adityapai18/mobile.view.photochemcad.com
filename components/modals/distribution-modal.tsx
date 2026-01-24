import React, { useEffect, useState } from 'react';
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
import { DistributionParams } from '../../lib/types';
import { ThemedText } from '../themed-text';

const DEFAULT: DistributionParams = {
  type: 'gaussian',
  lowWavelength: 200,
  highWavelength: 800,
};

interface DistributionModalProps {
  visible: boolean;
  onClose: () => void;
  distributions: DistributionParams[];
  onDistributionsChange: (distributions: DistributionParams[]) => void;
}

const TYPES: { id: DistributionParams['type']; label: string }[] = [
  { id: 'blackbody', label: 'Blackbody' },
  { id: 'gaussian', label: 'Gaussian' },
  { id: 'lorentzian', label: 'Lorentzian' },
];

export function DistributionModal({
  visible,
  onClose,
  distributions,
  onDistributionsChange,
}: DistributionModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({}, 'icon');
  const borderColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(128,128,128,0.35)';
  const tintColor = useThemeColor({}, 'tint');
  const primaryButtonTextColor = isDark ? '#11181C' : '#ffffff';
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : undefined;
  const cardBg = useThemeColor({}, 'background');

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [form, setForm] = useState<DistributionParams>({ ...DEFAULT });

  const resetForm = () => {
    setForm({ type: 'gaussian', lowWavelength: 200, highWavelength: 800 });
    setEditingIndex(null);
  };

  useEffect(() => {
    if (!visible) resetForm();
  }, [visible]);

  const updateForm = <K extends keyof DistributionParams>(key: K, value: DistributionParams[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const buildParams = (): DistributionParams => {
    const base = { type: form.type, lowWavelength: form.lowWavelength, highWavelength: form.highWavelength };
    if (form.type === 'blackbody') {
      return { ...base, temperature: form.temperature ?? 5776 };
    }
    if (form.type === 'gaussian') {
      return {
        ...base,
        peakWavelength: form.peakWavelength ?? 300,
        standardDeviation: form.standardDeviation ?? 20,
        gaussianMultiplier: form.gaussianMultiplier ?? 1,
      };
    }
    return {
      ...base,
      lorentzianPeakWavelength: form.lorentzianPeakWavelength ?? 300,
      fwhm: form.fwhm ?? 20,
      lorentzianMultiplier: form.lorentzianMultiplier ?? 1,
    };
  };

  const handleAddOrUpdate = () => {
    const built = buildParams();
    if (editingIndex !== null) {
      const next = [...distributions];
      next[editingIndex] = built;
      onDistributionsChange(next);
    } else {
      onDistributionsChange([...distributions, built]);
    }
    resetForm();
  };

  const handleEdit = (index: number) => {
    setForm({ ...distributions[index] });
    setEditingIndex(index);
  };

  const handleDelete = (index: number) => {
    onDistributionsChange(distributions.filter((_, i) => i !== index));
    resetForm();
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
              Distribution comparison settings
            </ThemedText>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={textColor} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 16 }}>
            {/* Current list */}
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>
                Current distributions {distributions.length > 0 && `(${distributions.length})`}
              </ThemedText>
              {distributions.length === 0 ? (
                <ThemedText style={styles.muted}>No distributions added yet.</ThemedText>
              ) : (
                <View style={styles.list}>
                  {distributions.map((d, i) => (
                    <View
                      key={i}
                      style={[styles.listItem, { borderColor }]}
                    >
                      <ThemedText style={styles.listItemLabel} numberOfLines={1}>
                        {d.type} ({d.lowWavelength}–{d.highWavelength} nm)
                      </ThemedText>
                      <View style={styles.listItemActions}>
                        <Pressable
                          style={[styles.smBtn, { borderColor }]}
                          onPress={() => handleEdit(i)}
                        >
                          <ThemedText style={styles.smBtnText}>Edit</ThemedText>
                        </Pressable>
                        <Pressable
                          style={[styles.smBtn, { borderColor }]}
                          onPress={() => handleDelete(i)}
                        >
                          <Ionicons name="close" size={16} color={textColor} />
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Add/Edit form */}
            <View style={[styles.formCard, { borderColor }]}>
              <ThemedText style={styles.formTitle}>
                {editingIndex !== null ? 'Edit distribution' : 'Add new distribution'}
              </ThemedText>

              <View style={styles.section}>
                <ThemedText style={styles.label}>Type</ThemedText>
                <View style={styles.typeRow}>
                  {TYPES.map(t => (
                    <Pressable
                      key={t.id}
                      style={[
                        styles.typeChip,
                        { borderColor },
                        form.type === t.id && { backgroundColor: tintColor, borderColor: tintColor },
                      ]}
                      onPress={() => updateForm('type', t.id)}
                    >
                      <ThemedText
                        style={[
                          styles.typeChipText,
                          form.type === t.id && { color: primaryButtonTextColor },
                        ]}
                      >
                        {t.label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>

              <ParamRow
                label="Low wavelength (nm)"
                value={form.lowWavelength}
                onChange={v => updateForm('lowWavelength', v)}
                borderColor={borderColor}
                textColor={textColor}
                inputBg={inputBg}
              />
              <ParamRow
                label="High wavelength (nm)"
                value={form.highWavelength}
                onChange={v => updateForm('highWavelength', v)}
                borderColor={borderColor}
                textColor={textColor}
                inputBg={inputBg}
              />

              {form.type === 'blackbody' && (
                <ParamRow
                  label="Temperature (K)"
                  value={form.temperature ?? 5776}
                  onChange={v => updateForm('temperature', v)}
                  borderColor={borderColor}
                  textColor={textColor}
                  inputBg={inputBg}
                />
              )}

              {form.type === 'gaussian' && (
                <>
                  <ParamRow
                    label="Peak wavelength (nm)"
                    value={form.peakWavelength ?? 300}
                    onChange={v => updateForm('peakWavelength', v)}
                    borderColor={borderColor}
                    textColor={textColor}
                    inputBg={inputBg}
                  />
                  <ParamRow
                    label="Standard deviation (nm)"
                    value={form.standardDeviation ?? 20}
                    onChange={v => updateForm('standardDeviation', v)}
                    borderColor={borderColor}
                    textColor={textColor}
                    inputBg={inputBg}
                  />
                  <ParamRow
                    label="Multiplier"
                    value={form.gaussianMultiplier ?? 1}
                    onChange={v => updateForm('gaussianMultiplier', v)}
                    borderColor={borderColor}
                    textColor={textColor}
                    inputBg={inputBg}
                  />
                </>
              )}

              {form.type === 'lorentzian' && (
                <>
                  <ParamRow
                    label="Peak wavelength (nm)"
                    value={form.lorentzianPeakWavelength ?? 300}
                    onChange={v => updateForm('lorentzianPeakWavelength', v)}
                    borderColor={borderColor}
                    textColor={textColor}
                    inputBg={inputBg}
                  />
                  <ParamRow
                    label="FWHM (nm)"
                    value={form.fwhm ?? 20}
                    onChange={v => updateForm('fwhm', v)}
                    borderColor={borderColor}
                    textColor={textColor}
                    inputBg={inputBg}
                  />
                  <ParamRow
                    label="Multiplier"
                    value={form.lorentzianMultiplier ?? 1}
                    onChange={v => updateForm('lorentzianMultiplier', v)}
                    borderColor={borderColor}
                    textColor={textColor}
                    inputBg={inputBg}
                  />
                </>
              )}

              {form.type === 'blackbody' && (
                <ThemedText style={styles.hint}>Sun photosphere ≈ 5776 K</ThemedText>
              )}

              <View style={styles.formActions}>
                <Pressable
                  style={[styles.primaryBtn, { backgroundColor: tintColor }]}
                  onPress={handleAddOrUpdate}
                >
                  <Ionicons name="add" size={18} color={primaryButtonTextColor} />
                  <ThemedText style={[styles.primaryBtnText, { color: primaryButtonTextColor }]}>
                    {editingIndex !== null ? 'Update' : 'Add'}
                  </ThemedText>
                </Pressable>
                {editingIndex !== null && (
                  <Pressable style={[styles.secondaryBtn, { borderColor }]} onPress={resetForm}>
                    <ThemedText style={styles.secondaryBtnText}>Cancel edit</ThemedText>
                  </Pressable>
                )}
              </View>
            </View>

            <Pressable style={[styles.closeBtn, { borderColor: tintColor }]} onPress={onClose}>
              <ThemedText style={[styles.closeBtnText, { color: tintColor }]}>Close</ThemedText>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ParamRow({
  label,
  value,
  onChange,
  borderColor,
  textColor,
  inputBg,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  borderColor: string;
  textColor: string;
  inputBg: string | undefined;
}) {
  return (
    <View style={styles.paramRow}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <TextInput
        style={[styles.input, { borderColor, color: textColor, backgroundColor: inputBg }]}
        keyboardType="numeric"
        value={String(value)}
        onChangeText={t => onChange(parseFloat(t) || 0)}
      />
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
  body: { paddingHorizontal: 16, paddingTop: 12 },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  muted: { fontSize: 13, opacity: 0.7 },
  list: { flexDirection: 'column', gap: 8 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  listItemLabel: { fontSize: 14, flex: 1, textTransform: 'capitalize' },
  listItemActions: { flexDirection: 'row', gap: 8 },
  smBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  smBtnText: { fontSize: 13, fontWeight: '600' },
  formCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  formTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  label: { fontSize: 13, opacity: 0.85, marginBottom: 4 },
  paramRow: { marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  typeChipText: { fontSize: 13, fontWeight: '600' },
  hint: { fontSize: 12, opacity: 0.7, marginTop: -4, marginBottom: 8 },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  primaryBtnText: { fontSize: 14, fontWeight: '600' },
  secondaryBtn: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '500' },
  closeBtn: {
    marginTop: 16,
    alignSelf: 'stretch',
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
  },
  closeBtnText: { fontSize: 15, fontWeight: '600' },
});
