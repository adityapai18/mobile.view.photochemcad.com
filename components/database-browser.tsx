import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useThemeColor } from '../hooks/use-theme-color';
import { getCompoundStructureImageSource } from '../lib/compound-structure-images.generated';
import { Compound, getCompounds, searchCompounds } from '../lib/database';
import { SelectedSpectrum } from '../lib/types';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface DatabaseBrowserProps {
  onSpectrumAdd: (spectrum: { compound: Compound; type: 'absorption' | 'emission' }) => void;
  onSpectrumRemove: (compoundId: string, type: 'absorption' | 'emission') => void;
  selectedSpectra: SelectedSpectrum[];
}

function compoundProperty(label: string, value: string | number | null | undefined): { label: string; value: string } | null {
  if (value == null || value === '') return null;
  return { label, value: String(value) };
}

export function DatabaseBrowser({ onSpectrumAdd, onSpectrumRemove, selectedSpectra }: DatabaseBrowserProps) {
  const [compounds, setCompounds] = useState<Compound[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCompound, setSelectedCompound] = useState<Compound | null>(null);

  const loadCompounds = async (query: string = '') => {
    setIsLoading(true);
    try {
      const results = query.trim()
        ? await searchCompounds(query)
        : await getCompounds();
      setCompounds(results);
    } catch (error) {
      console.error('Error loading compounds:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCompounds(searchQuery);
  }, [searchQuery]);

  const isSelected = (compound: Compound, type: 'absorption' | 'emission') => {
    return selectedSpectra.some(
      s => s.compound.id === compound.id && s.type === type
    );
  };

  const renderCompound = ({ item: compound }: { item: Compound }) => {
    const hasAbs = compound.has_absorption_data === '1';
    const hasEm = compound.has_emission_data === '1';
    const absSelected = isSelected(compound, 'absorption');
    const emSelected = isSelected(compound, 'emission');
    const structureImageSource = getCompoundStructureImageSource(compound.database_name, compound.id);

    return (
      <View style={styles.compoundItem}>
        <TouchableOpacity
          style={styles.compoundRowTouchable}
          onPress={() => setSelectedCompound(compound)}
          activeOpacity={0.7}
        >
          {structureImageSource != null ? (
            <Image
              source={structureImageSource}
              style={styles.compoundStructureImage}
              contentFit="contain"
            />
          ) : (
            <View style={[styles.compoundStructurePlaceholder, { borderColor: iconColor }]} />
          )}
          <View style={styles.compoundInfo}>
            <ThemedText style={styles.compoundName}>{compound.name}</ThemedText>
            <ThemedText style={[styles.compoundId, { color: iconColor }]}>{compound.id}</ThemedText>
          </View>
        </TouchableOpacity>
        <View style={styles.checkboxContainer}>
          {hasAbs && (
            <TouchableOpacity
              onPress={() => {
                if (absSelected) {
                  onSpectrumRemove(compound.id, 'absorption');
                } else {
                  onSpectrumAdd({ compound, type: 'absorption' });
                }
              }}
            >
              <View style={[styles.checkbox, absSelected && styles.checkboxSelected]}>
                <ThemedText style={styles.checkboxLabel}>Abs</ThemedText>
              </View>
            </TouchableOpacity>
          )}
          {hasEm && (
            <TouchableOpacity
              onPress={() => {
                if (emSelected) {
                  onSpectrumRemove(compound.id, 'emission');
                } else {
                  onSpectrumAdd({ compound, type: 'emission' });
                }
              }}
            >
              <View style={[styles.checkbox, emSelected && styles.checkboxSelected]}>
                <ThemedText style={styles.checkboxLabel}>Em</ThemedText>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({}, 'icon');

  return (
    <ThemedView style={[styles.container, ]}>
      <ThemedText type="title" style={styles.title}>Database Browser</ThemedText>

      <View style={styles.section}>
        <TextInput
          style={[styles.searchInput, { borderColor: iconColor, color: textColor }]}
          placeholder="Search compounds..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={iconColor}
        />
      </View>

      <View style={styles.section}>
        <ThemedText style={[styles.sectionTitle, { color: iconColor }]}>Compounds</ThemedText>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#3b82f6" />
          </View>
        ) : (
          <View style={[styles.compoundsListContainer, { borderColor: iconColor }]}>
            {compounds.length === 0 ? (
              <View style={styles.loadingContainer}>
                <ThemedText style={[styles.emptyText, { color: iconColor }]}>No compounds found</ThemedText>
              </View>
            ) : (
              <ScrollView
                style={styles.compoundsList}
                contentContainerStyle={styles.compoundsListContent}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
              >
                {compounds.map((compound) => (
                  <React.Fragment key={compound.id}>
                    {renderCompound({ item: compound })}
                  </React.Fragment>
                ))}
              </ScrollView>
            )}
          </View>
        )}
      </View>

      <Modal
        visible={selectedCompound != null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedCompound(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedCompound(null)}>
          <Pressable style={[styles.modalContent, { backgroundColor }]} onPress={e => e.stopPropagation()}>
            {selectedCompound && (
              <>
                <View style={styles.modalHeader}>
                  <ThemedText type="title" style={styles.modalTitle}>{selectedCompound.name}</ThemedText>
                  <TouchableOpacity onPress={() => setSelectedCompound(null)} hitSlop={12}>
                    <ThemedText style={[styles.modalClose, { color: iconColor }]}>Close</ThemedText>
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                  {(() => {
                    const imgSrc = getCompoundStructureImageSource(selectedCompound.database_name, selectedCompound.id);
                    return imgSrc != null ? (
                      <Image source={imgSrc} style={styles.modalImage} contentFit="contain" />
                    ) : (
                      <View style={[styles.modalImagePlaceholder, { borderColor: iconColor }]} />
                    );
                  })()}
                  <ThemedText style={[styles.modalId, { color: iconColor }]}>{selectedCompound.id}</ThemedText>
                  {[
                    compoundProperty('Chemical formula', selectedCompound.chemical_formula),
                    compoundProperty('Molecular weight', selectedCompound.molecular_weight),
                    compoundProperty('CAS', selectedCompound.cas),
                    compoundProperty('Category', selectedCompound.category_name),
                    compoundProperty('Class', selectedCompound.class_name),
                    compoundProperty('Synonym', selectedCompound.synonym),
                    compoundProperty('Absorption solvent', selectedCompound.absorption_solvent),
                    compoundProperty('Emission solvent', selectedCompound.emission_solvent),
                    compoundProperty('Absorption λ', selectedCompound.absorption_wavelength),
                    compoundProperty('Emission λ', selectedCompound.emission_wavelength),
                    compoundProperty('Quantum yield', selectedCompound.emission_quantum_yield),
                  ]
                    .filter((p): p is { label: string; value: string } => p != null)
                    .map(p => (
                      <View key={p.label} style={styles.propertyRow}>
                        <ThemedText style={[styles.propertyLabel, { color: iconColor }]}>{p.label}:</ThemedText>
                        <ThemedText style={styles.propertyValue}>{p.value}</ThemedText>
                      </View>
                    ))}
                </ScrollView>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 8,
    marginTop: 16,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 10,
    fontSize: 14,
    backgroundColor: 'transparent',
  },
  compoundsListContainer: {
    height: 250,
    borderWidth: 1,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  compoundsList: {
    flex: 1,
    height: 250,
  },
  compoundsListContent: {
    paddingBottom: 8,
  },
  compoundItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  compoundRowTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  compoundStructureImage: {
    width: 44,
    height: 44,
    borderRadius: 4,
    marginRight: 12,
    backgroundColor: '#f5f5f5',
  },
  compoundStructurePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 4,
    marginRight: 12,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  compoundInfo: {
    flex: 1,
  },
  compoundName: {
    fontSize: 14,
    fontWeight: '500',
  },
  compoundId: {
    fontSize: 12,
    marginTop: 2,
    opacity: 0.7,
  },
  checkboxContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  checkbox: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
  },
  checkboxSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  checkboxLabel: {
    fontSize: 10,
    color: '#333',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    padding: 20,
    opacity: 0.6,
  },
  selectedItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    borderRadius: 4,
    marginBottom: 4,
    opacity: 0.8,
  },
  selectedText: {
    fontSize: 12,
  },
  removeText: {
    fontSize: 18,
    color: '#ef4444',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  modalClose: {
    fontSize: 16,
  },
  modalBody: {
    padding: 16,
    maxHeight: 400,
  },
  modalImage: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: 220,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignSelf: 'center',
  },
  modalImagePlaceholder: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: 220,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'center',
  },
  modalId: {
    fontSize: 14,
    marginTop: 8,
    marginBottom: 12,
  },
  propertyRow: {
    flexDirection: 'row',
    marginBottom: 6,
    gap: 8,
  },
  propertyLabel: {
    fontSize: 13,
    minWidth: 120,
  },
  propertyValue: {
    fontSize: 13,
    flex: 1,
  },
});
