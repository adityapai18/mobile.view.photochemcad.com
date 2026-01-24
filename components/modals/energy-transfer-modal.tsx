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
  SimulationMode,
  calcEnergyTransferForward,
  calcEnergyTransferReverse,
  clamp01,
} from '../../lib/energy-transfer';
import { ThemedText } from '../themed-text';
import { ThemedView } from '../themed-view';

interface EnergyTransferComponent {
  id: string;
  name: string;
  E: number;
  EPrime: number;
  QY: number;
  T: number;
  QYPrime: number;
}

interface EnergyTransferModalProps {
  visible: boolean;
  onClose: () => void;
  selectedSpectra: SelectedSpectrum[];
}

function computeEPrime(list: EnergyTransferComponent[]): EnergyTransferComponent[] {
  const sumE = list.reduce((s, c) => s + (Number(c.E) || 0), 0);
  if (sumE <= 0) return list.map(c => ({ ...c, EPrime: 0 }));
  return list.map(c => ({ ...c, EPrime: (Number(c.E) || 0) / sumE }));
}

export function EnergyTransferModal({
  visible,
  onClose,
  selectedSpectra,
}: EnergyTransferModalProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const backgroundColor = useThemeColor({}, 'background');
  const cardColor = backgroundColor;
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({}, 'icon');
  const borderColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(128,128,128,0.35)';
  const tintColor = useThemeColor({}, 'tint');
  const cardBackgroundColor = cardColor || backgroundColor;
  const primaryButtonTextColor = isDark ? '#11181C' : '#ffffff';
  const inputBg = isDark ? 'rgba(255,255,255,0.06)' : undefined;

  const [excitationWavelength, setExcitationWavelength] = useState(450);
  const [simulationMode, setSimulationMode] = useState<SimulationMode>('reverse');
  const [components, setComponents] = useState<EnergyTransferComponent[]>([]);
  const [selectedWavelengths, setSelectedWavelengths] = useState<number[]>([]);
  const [newWavelength, setNewWavelength] = useState('');

  const [reverseStats, setReverseStats] = useState<{
    totalQY: number;
    r2: number;
    meanResidual: number;
    maxResidual: number;
    lsq: number;
  } | null>(null);

  const emissionSpectra = useMemo(
    () => selectedSpectra.filter(s => s.type === 'emission'),
    [selectedSpectra]
  );

  const autoPopulateComponents = () => {
    if (emissionSpectra.length === 0) {
      setComponents([]);
      return;
    }

    let spectraToUse = emissionSpectra;

    if (simulationMode === 'reverse' && emissionSpectra.length > 1) {
      spectraToUse = emissionSpectra.slice(1);
      setSelectedWavelengths(
        selectedSpectra
          .map(s => Number((s.compound as any).emission_wavelength))
          .filter(v => !isNaN(v))
      );
    }

    const newComponents: EnergyTransferComponent[] = spectraToUse.map((spectrum, index) => ({
      id: spectrum.compound.id,
      name: spectrum.compound.name,
      E: 0,
      EPrime: 0,
      QY: Number((spectrum.compound as any).emission_quantum_yield) || 0,
      T:
        simulationMode !== 'reverse'
          ? index === spectraToUse.length - 1
            ? 0
            : 1
          : 0.1,
      QYPrime: 0,
    }));

    setComponents(computeEPrime(newComponents));
  };

  useEffect(() => {
    if (visible) {
      setExcitationWavelength(450);
      setSimulationMode('reverse');
      setComponents([]);
      setSelectedWavelengths([]);
      setNewWavelength('');
      setReverseStats(null);
      autoPopulateComponents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, selectedSpectra]);

  useEffect(() => {
    if (visible) {
      autoPopulateComponents();
      setReverseStats(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulationMode]);

  const handleComponentChange = (
    index: number,
    field: keyof EnergyTransferComponent,
    value: number
  ) => {
    if (field === 'E') {
      setComponents(prev => {
        const next = prev.map((c, i) => (i === index ? { ...c, E: Number(value) || 0 } : c));
        return computeEPrime(next);
      });
    } else {
      setComponents(prev =>
        prev.map((c, i) => (i === index ? { ...c, [field]: Number(value) || 0 } : c))
      );
    }
  };

  const handleAddWavelength = () => {
    const wavelength = parseFloat(newWavelength);
    if (!isNaN(wavelength) && wavelength > 0 && !selectedWavelengths.includes(wavelength)) {
      setSelectedWavelengths(prev => [...prev, wavelength].sort((a, b) => a - b));
      setNewWavelength('');
    }
  };

  const handleRemoveWavelength = (wavelength: number) => {
    setSelectedWavelengths(prev => prev.filter(w => w !== wavelength));
  };

  const toETInput = (list: EnergyTransferComponent[]) =>
    list.map(c => ({
      id: c.id,
      name: c.name,
      E: Number(c.E) || 0,
      QY: clamp01(Number(c.QY) || 0),
      T: clamp01(Number(c.T) || 0),
    }));

  const handleRun = () => {
    if (simulationMode === 'forward') {
      if (!components.length) {
        console.warn('Add at least one component to simulate.');
        return;
      }
      const f = calcEnergyTransferForward(toETInput(components));
      setComponents(prev =>
        prev.map((c, i) => ({ ...c, QYPrime: f.components[i]?.QYPrime ?? 0 }))
      );
      setReverseStats(null);
      return;
    }

    if (emissionSpectra.length < 2) {
      console.warn('Reverse analysis needs array + at least one component emission.');
      return;
    }
    if (selectedWavelengths.length === 0) {
      console.warn('Pick at least one wavelength for reverse analysis.');
      return;
    }

    try {
      const rev = calcEnergyTransferReverse(emissionSpectra, toETInput(components), {
        selectedWavelengths,
        zeroLastT: true,
        maxIter: 1000,
        baseTol: 1e-9,
        bounds: { low: 0, high: 1 },
      });

      setComponents(prev =>
        prev.map((c, i) => ({
          ...c,
          T: rev.components[i]?.T ?? c.T,
          QYPrime: rev.components[i]?.QYPrime ?? c.QYPrime,
        }))
      );

      setReverseStats({
        totalQY: rev.totalQY,
        r2: rev.rSquared,
        meanResidual: rev.meanResidual,
        maxResidual: rev.maxResidual,
        lsq: rev.lsq,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable
          style={[
            styles.card,
            {
              backgroundColor: cardBackgroundColor,
              borderColor,
            },
          ]}
          onPress={() => {}}
        >
          <ThemedView style={styles.header}>
            <ThemedText type="subtitle" style={styles.title}>
              Energy Transfer Simulation
            </ThemedText>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={textColor} />
            </Pressable>
          </ThemedView>

          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 16 }}>
            {emissionSpectra.length === 0 ? (
              <View style={styles.noticeBox}>
                <ThemedText style={styles.noticeTitle}>
                  No emission spectra selected
                </ThemedText>
                <ThemedText style={styles.noticeText}>
                  Select at least one emission spectrum in the dashboard to run an energy
                  transfer simulation.
                </ThemedText>
              </View>
            ) : (
              <>
                <View style={styles.row}>
                  <View style={styles.column}>
                    <ThemedText style={styles.label}>Excitation wavelength (nm)</ThemedText>
                    <TextInput
                      style={[styles.input, { borderColor, color: textColor, backgroundColor: inputBg }]}
                      placeholderTextColor={iconColor}
                      keyboardType="numeric"
                      value={String(excitationWavelength)}
                      onChangeText={text =>
                        setExcitationWavelength(parseFloat(text) || 0)
                      }
                    />
                  </View>
                  <View style={styles.column}>
                    <ThemedText style={styles.label}>Mode</ThemedText>
                    <View style={styles.modeRow}>
                      <Pressable
                        style={[
                          styles.chip,
                          { borderColor },
                          simulationMode === 'forward' && {
                            backgroundColor: tintColor,
                          },
                        ]}
                        onPress={() => setSimulationMode('forward')}
                      >
                        <ThemedText
                          style={[
                            styles.chipText,
                            simulationMode === 'forward' && { color: primaryButtonTextColor },
                          ]}
                        >
                          Forward
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.chip,
                          { borderColor },
                          simulationMode === 'reverse' && {
                            backgroundColor: tintColor,
                          },
                        ]}
                        onPress={() => setSimulationMode('reverse')}
                      >
                        <ThemedText
                          style={[
                            styles.chipText,
                            simulationMode === 'reverse' && { color: primaryButtonTextColor },
                          ]}
                        >
                          Reverse
                        </ThemedText>
                      </Pressable>
                    </View>
                  </View>
                </View>

                <View style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>Components</ThemedText>
                  {components.map((c, index) => (
                    <View key={c.id} style={styles.componentCard}>
                      <ThemedText style={styles.componentName}>
                        {c.name}
                      </ThemedText>
                      <View style={styles.componentRow}>
                        <View style={styles.componentField}>
                          <ThemedText style={styles.labelSmall}>E</ThemedText>
                          <TextInput
                            style={[styles.input, styles.inputSmall, { borderColor, color: textColor, backgroundColor: inputBg }]}
                            placeholderTextColor={iconColor}
                            keyboardType="numeric"
                            value={String(c.E)}
                            onChangeText={text =>
                              handleComponentChange(index, 'E', parseFloat(text) || 0)
                            }
                          />
                        </View>
                        <View style={styles.componentField}>
                          <ThemedText style={styles.labelSmall}>E′</ThemedText>
                          <ThemedText style={styles.valueSmall}>
                            {c.EPrime.toFixed(3)}
                          </ThemedText>
                        </View>
                        <View style={styles.componentField}>
                          <ThemedText style={styles.labelSmall}>QY</ThemedText>
                          <TextInput
                            style={[styles.input, styles.inputSmall, { borderColor, color: textColor, backgroundColor: inputBg }]}
                            placeholderTextColor={iconColor}
                            keyboardType="numeric"
                            value={String(c.QY)}
                            onChangeText={text =>
                              handleComponentChange(index, 'QY', parseFloat(text) || 0)
                            }
                          />
                        </View>
                        <View style={styles.componentField}>
                          <ThemedText style={styles.labelSmall}>T</ThemedText>
                          <TextInput
                            style={[styles.input, styles.inputSmall, { borderColor, color: textColor, backgroundColor: inputBg }]}
                            placeholderTextColor={iconColor}
                            keyboardType="numeric"
                            value={String(c.T)}
                            onChangeText={text =>
                              handleComponentChange(index, 'T', parseFloat(text) || 0)
                            }
                          />
                        </View>
                        <View style={styles.componentField}>
                          <ThemedText style={styles.labelSmall}>QY′</ThemedText>
                          <ThemedText style={styles.valueSmall}>
                            {c.QYPrime.toFixed(4)}
                          </ThemedText>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>

                {simulationMode === 'reverse' && (
                  <View style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>
                      Wavelengths (nm)
                    </ThemedText>
                    <View style={styles.row}>
                      <View style={[styles.column, { flex: 1.2 }]}>
                        <ThemedText style={styles.label}>Add wavelength</ThemedText>
                        <View style={styles.addWaveRow}>
                          <TextInput
                            style={[styles.input, { borderColor, flex: 1, color: textColor, backgroundColor: inputBg }]}
                            placeholderTextColor={iconColor}
                            keyboardType="numeric"
                            placeholder="e.g. 550.5"
                            value={newWavelength}
                            onChangeText={setNewWavelength}
                          />
                          <Pressable
                            style={[styles.iconButton, { borderColor }]}
                            onPress={handleAddWavelength}
                          >
                            <Ionicons name="add" size={18} color={tintColor} />
                          </Pressable>
                        </View>
                      </View>
                    </View>
                    <View style={styles.chipContainer}>
                      {selectedWavelengths.length === 0 ? (
                        <ThemedText style={styles.mutedText}>
                          No wavelengths selected
                        </ThemedText>
                      ) : (
                        selectedWavelengths.map(w => (
                          <Pressable
                            key={w}
                            style={[styles.waveChip, { borderColor }]}
                            onPress={() => handleRemoveWavelength(w)}
                          >
                            <ThemedText style={styles.waveChipText}>{w}</ThemedText>
                            <Ionicons
                              name="close"
                              size={14}
                              color={textColor}
                              style={{ marginLeft: 4 }}
                            />
                          </Pressable>
                        ))
                      )}
                    </View>
                  </View>
                )}

                <View style={styles.actionsRow}>
                  <Pressable
                    style={[styles.primaryButton, { backgroundColor: tintColor }]}
                    onPress={handleRun}
                  >
                    <ThemedText style={[styles.primaryButtonText, { color: primaryButtonTextColor }]}>
                      Run
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.secondaryButton,
                      { borderColor: tintColor },
                    ]}
                    onPress={handleClose}
                  >
                    <ThemedText
                      style={[styles.secondaryButtonText, { color: tintColor }]}
                    >
                      Close
                    </ThemedText>
                  </Pressable>
                </View>

                {reverseStats && (
                  <View style={styles.statsCard}>
                    <ThemedText style={styles.statsTitle}>Reverse stats</ThemedText>
                    <ThemedText style={styles.statsText}>
                      Total QY: {reverseStats.totalQY.toFixed(5)}
                    </ThemedText>
                    <ThemedText style={styles.statsText}>
                      R²: {reverseStats.r2.toFixed(4)}
                    </ThemedText>
                    <ThemedText style={styles.statsText}>
                      Mean residual: {reverseStats.meanResidual.toFixed(5)}
                    </ThemedText>
                    <ThemedText style={styles.statsText}>
                      Max residual: {reverseStats.maxResidual.toFixed(5)}
                    </ThemedText>
                    <ThemedText style={styles.statsText}>
                      LSQ (√SSE): {reverseStats.lsq.toFixed(5)}
                    </ThemedText>
                  </View>
                )}
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
    borderBottomColor: 'rgba(128,128,128,0.25)',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  noticeBox: {
    paddingVertical: 16,
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  noticeText: {
    fontSize: 13,
    opacity: 0.8,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  column: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    opacity: 0.8,
    marginBottom: 4,
  },
  labelSmall: {
    fontSize: 11,
    opacity: 0.7,
    marginBottom: 2,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
  },
  inputSmall: {
    width: 70,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.35)',
  },
  chipText: {
    fontSize: 13,
  },
  section: {
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  componentCard: {
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.25)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  componentName: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  componentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  componentField: {
    flexDirection: 'column',
  },
  valueSmall: {
    fontSize: 12,
    opacity: 0.8,
  },
  addWaveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  mutedText: {
    fontSize: 12,
    opacity: 0.6,
  },
  waveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  waveChipText: {
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  primaryButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  statsCard: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.4)',
    backgroundColor: 'rgba(22,163,74,0.05)',
    borderRadius: 12,
    padding: 12,
  },
  statsTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  statsText: {
    fontSize: 12,
    marginBottom: 2,
  },
});

