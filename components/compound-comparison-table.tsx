import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';
import { Compound } from '@/lib/database';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

type Row = {
  key: string;
  label: string;
  getValue: (c: Compound) => string;
};

function fmt(v: unknown): string {
  if (v == null) return '—';
  if (typeof v === 'string') return v.trim() ? v : '—';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '—';
  return String(v);
}

export function CompoundComparisonTable({ compounds }: { compounds: Compound[] }) {
  const borderColor = useThemeColor({}, 'icon');

  const rows: Row[] = useMemo(
    () => [
      { key: 'cas', label: 'CAS', getValue: (c) => fmt(c.cas) },
      { key: 'formula', label: 'Formula', getValue: (c) => fmt(c.chemical_formula) },
      { key: 'mw', label: 'Molecular weight', getValue: (c) => fmt(c.molecular_weight) },
      { key: 'class', label: 'Class', getValue: (c) => fmt(c.class_name) },
      { key: 'category', label: 'Category', getValue: (c) => fmt(c.category_name) },
      { key: 'db', label: 'Database', getValue: (c) => fmt(c.database_name) },
      { key: 'synonym', label: 'Synonym', getValue: (c) => fmt(c.synonym) },
      { key: 'abs_wl', label: 'Absorption λ (nm)', getValue: (c) => fmt(c.absorption_wavelength) },
      { key: 'abs_eps', label: 'Absorption ε', getValue: (c) => fmt(c.absorption_epsilon) },
      { key: 'abs_coef', label: 'Absorption coefficient', getValue: (c) => fmt(c.absorption_coefficient) },
      { key: 'abs_sol', label: 'Absorption solvent', getValue: (c) => fmt(c.absorption_solvent) },
      { key: 'abs_inst', label: 'Absorption instrument', getValue: (c) => fmt(c.absorption_instrument) },
      { key: 'abs_ref', label: 'Absorption reference', getValue: (c) => fmt(c.absorption_reference) },
      { key: 'em_wl', label: 'Emission λ (nm)', getValue: (c) => fmt(c.emission_wavelength) },
      { key: 'em_peaks', label: 'Emission peaks', getValue: (c) => fmt(c.emission_fluorescence_peaks) },
      { key: 'qy', label: 'Quantum yield (ΦF)', getValue: (c) => fmt(c.emission_quantum_yield) },
      { key: 'em_sol', label: 'Emission solvent', getValue: (c) => fmt(c.emission_solvent) },
      { key: 'em_inst', label: 'Emission instrument', getValue: (c) => fmt(c.emission_instrument) },
      { key: 'em_ref', label: 'Emission reference', getValue: (c) => fmt(c.emission_reference) },
      { key: 'source', label: 'Source', getValue: (c) => fmt(c.source_name) },
    ],
    []
  );

  if (compounds.length === 0) {
    return (
      <ThemedView style={styles.card}>
        <ThemedText style={styles.title}>Compound properties</ThemedText>
        <ThemedText style={{ opacity: 0.7 }}>
          Select spectra to see a compound comparison table.
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.card}>
      <ThemedText style={styles.title}>Compound properties</ThemedText>

      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View style={styles.table}>
          {/* Header row: left label + compound columns */}
          <View style={[styles.row, styles.headerRow, { borderBottomColor: borderColor }]}>
            <View style={[styles.attrCell, styles.headerCell, { borderRightColor: borderColor }]}>
              <ThemedText style={styles.headerText}>Compound</ThemedText>
            </View>
            {compounds.map((c) => (
              <View
                key={`col-${c.id}`}
                style={[styles.compoundHeaderCell, styles.headerCell, { borderRightColor: borderColor }]}
              >
                <ThemedText style={styles.headerText} numberOfLines={1}>
                  {c.name}
                </ThemedText>
                <ThemedText style={[styles.subHeaderText]} numberOfLines={1}>
                  {c.id}
                </ThemedText>
              </View>
            ))}
          </View>

          {/* Rows: attributes on Y axis */}
          <ScrollView style={styles.bodyScroll} showsVerticalScrollIndicator nestedScrollEnabled>
            {rows.map((row) => (
              <View key={row.key} style={[styles.row, { borderBottomColor: 'rgba(128,128,128,0.2)' }]}>
                <View style={[styles.attrCell, { borderRightColor: 'rgba(128,128,128,0.15)' }]}>
                  <ThemedText style={styles.attrText} numberOfLines={2}>
                    {row.label}
                  </ThemedText>
                </View>
                {compounds.map((c) => (
                  <View
                    key={`${row.key}-${c.id}`}
                    style={[styles.valueCell, { borderRightColor: 'rgba(128,128,128,0.15)' }]}
                  >
                    <ThemedText style={styles.cellText} numberOfLines={2}>
                      {row.getValue(c)}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.18)',
    gap: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  table: {
    flexDirection: 'column',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    borderBottomWidth: 1,
  },
  attrCell: {
    width: 170,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRightWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  valueCell: {
    width: 170,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRightWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  compoundHeaderCell: {
    width: 170,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRightWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  headerCell: {
    paddingVertical: 12,
  },
  headerText: {
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.9,
  },
  subHeaderText: {
    fontSize: 11,
    opacity: 0.75,
    marginTop: 2,
  },
  attrText: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.9,
  },
  cellText: {
    fontSize: 12,
    opacity: 0.9,
  },
  bodyScroll: {
    maxHeight: 260,
  },
});

