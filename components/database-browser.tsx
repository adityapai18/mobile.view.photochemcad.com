import { Image } from 'expo-image';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useThemeColor } from '../hooks/use-theme-color';
import { getCompoundStructureImageSource } from '../lib/compound-structure-images.generated';
import { Compound, getCompoundsPaginated, getLiteratureReferences, LiteratureReference, searchCompoundsPaginated } from '../lib/database';
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

const PAGE_SIZE = 20;

export function DatabaseBrowser({ onSpectrumAdd, onSpectrumRemove, selectedSpectra }: DatabaseBrowserProps) {
  const [compounds, setCompounds] = useState<Compound[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selectedCompound, setSelectedCompound] = useState<Compound | null>(null);
  const compoundsLengthRef = useRef(0);
  const [selectedReferences, setSelectedReferences] = useState<LiteratureReference[]>([]);
  const [isRefsLoading, setIsRefsLoading] = useState(false);
  const [showingRefs, setShowingRefs] = useState(false);

  useEffect(() => {
    compoundsLengthRef.current = compounds.length;
  }, [compounds]);

  useEffect(() => {
    const loadRefs = async () => {
      if (!selectedCompound) {
        setSelectedReferences([]);
        setShowingRefs(false);
        return;
      }
      const raw = selectedCompound.general_references;
      if (!raw) {
        setSelectedReferences([]);
        return;
      }
      const baseKeys = raw
        .split(';')
        .map(k => k.trim())
        .filter(Boolean);
      if (baseKeys.length === 0) {
        setSelectedReferences([]);
        return;
      }
      const allKeyVariants = new Set<string>();
      for (const key of baseKeys) {
        allKeyVariants.add(key);
        if (key.startsWith('(') && key.endsWith(')')) {
          allKeyVariants.add(key.slice(1, -1));
        } else {
          allKeyVariants.add(`(${key})`);
        }
      }
      const keys = Array.from(allKeyVariants);
      try {
        setIsRefsLoading(true);
        const refs = await getLiteratureReferences(keys);
        setSelectedReferences(refs);
      } catch (error) {
        setSelectedReferences([]);
      } finally {
        setIsRefsLoading(false);
      }
    };
    loadRefs();
    setShowingRefs(false);
  }, [selectedCompound]);

  const loadCompounds = useCallback(async (query: string = '', reset: boolean = true) => {
    if (reset) {
      setIsLoading(true);
      setCompounds([]);
      setHasMore(true);
      compoundsLengthRef.current = 0;
    } else {
      setIsLoadingMore(true);
    }
    try {
      const offset = reset ? 0 : compoundsLengthRef.current;
      const results = query.trim()
        ? await searchCompoundsPaginated(query, PAGE_SIZE, offset)
        : await getCompoundsPaginated(PAGE_SIZE, offset);
      if (reset) {
        const uniqueResults = Array.from(
          new Map(results.map(c => [c.id, c])).values()
        );
        setCompounds(uniqueResults);
      } else {
        setCompounds(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          const newCompounds = results.filter(c => !existingIds.has(c.id));
          const combined = [...prev, ...newCompounds];
          return Array.from(new Map(combined.map(c => [c.id, c])).values());
        });
      }
      setHasMore(results.length === PAGE_SIZE);
    } catch (error) {
      console.error('Error loading compounds:', error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadCompounds(searchQuery, true);
  }, [searchQuery, loadCompounds]);

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

  const buildPropertyRows = (compound: Compound): { label: string; value: string }[] => {
    return [
      compoundProperty('Chemical formula', compound.chemical_formula),
      compoundProperty('CAS', compound.cas),
      compoundProperty('All CAS', compound.cas_all),
      compoundProperty('IUPAC name', compound.iupac_name)
    ].filter((p): p is { label: string; value: string } => p != null);
  };

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
        <View style={[styles.compoundsListContainer, { borderColor: iconColor }]}>
          {isLoading && compounds.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#3b82f6" />
            </View>
          ) : compounds.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ThemedText style={[styles.emptyText, { color: iconColor }]}>No compounds found</ThemedText>
            </View>
          ) : (
            <ScrollView
              style={styles.compoundsList}
              contentContainerStyle={styles.compoundsListContent}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
              scrollEnabled={true}
              bounces={true}
              onScroll={(event) => {
                const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
                const paddingToBottom = 100;
                const isCloseToBottom =
                  layoutMeasurement.height + contentOffset.y >=
                  contentSize.height - paddingToBottom;

                if (isCloseToBottom && !isLoadingMore && hasMore && !isLoading) {
                  // Load the next page of compounds when scrolling near the bottom
                  loadCompounds(searchQuery, false);
                }
              }}
            >
              {compounds.map((compound, index) => (
                <React.Fragment key={`${compound.id}-${compound.database_name || 'default'}-${index}`}>
                  {renderCompound({ item: compound })}
                </React.Fragment>
              ))}
              {isLoadingMore && (
                <View style={styles.loadingMoreContainer}>
                  <ActivityIndicator size="small" color="#3b82f6" />
                  <ThemedText style={styles.loadingMoreText}>Loading more...</ThemedText>
                </View>
              )}
              {!hasMore && compounds.length > 0 && (
                <View style={styles.loadingMoreContainer}>
                  <ThemedText style={styles.endOfListText}>No more compounds</ThemedText>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>

      <Modal
        visible={selectedCompound != null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedCompound(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor }]}>
            {selectedCompound && (
              <>
                <View style={styles.modalHeader}>
                  <ThemedText type="title" style={styles.modalTitle}>
                    {selectedCompound.name}
                  </ThemedText>
                  {!isRefsLoading && selectedReferences.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setShowingRefs(prev => !prev)}
                      style={styles.refsButton}
                      hitSlop={8}
                    >
                      <ThemedText style={[styles.refsButtonText, { color: iconColor }]}>
                        {showingRefs ? 'Details' : 'References'}
                      </ThemedText>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => setSelectedCompound(null)} hitSlop={12}>
                    <ThemedText style={[styles.modalClose, { color: iconColor }]}>Close</ThemedText>
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={styles.modalBody}
                  contentContainerStyle={styles.modalBodyContent}
                  showsVerticalScrollIndicator
                >
                  {showingRefs ? (
                    <View style={styles.referencesSection}>
                      <ThemedText style={[styles.sectionTitle, { color: iconColor }]}>
                        Literature references
                      </ThemedText>
                      {isRefsLoading ? (
                        <View style={styles.referencesLoading}>
                          <ActivityIndicator size="small" color="#3b82f6" />
                          <ThemedText style={styles.referencesLoadingText}>
                            Loading references…
                          </ThemedText>
                        </View>
                      ) : selectedReferences.length === 0 ? (
                        <ThemedText style={styles.referencesEmpty}>
                          No references listed for this compound.
                        </ThemedText>
                      ) : (
                        <View style={styles.referencesList}>
                          {selectedReferences.map(ref => (
                            <View key={ref.author_year} style={styles.referenceItem}>
                              <ThemedText style={styles.referenceKey}>{ref.author_year}</ThemedText>
                              <ThemedText style={styles.referenceText}>{ref.full_citation}</ThemedText>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  ) : (
                    <>
                      {(() => {
                        const imgSrc = getCompoundStructureImageSource(
                          selectedCompound.database_name,
                          selectedCompound.id
                        );
                        return imgSrc != null ? (
                          <Image source={imgSrc} style={styles.modalImage} contentFit="contain" />
                        ) : (
                          <View
                            style={[styles.modalImagePlaceholder, { borderColor: iconColor }]}
                          />
                        );
                      })()}
                      <ThemedText style={[styles.modalId, { color: iconColor }]}>
                        {selectedCompound.id}
                      </ThemedText>

                      {buildPropertyRows(selectedCompound).map(item => (
                        <View key={item.label} style={styles.propertyRow}>
                          <ThemedText style={[styles.propertyLabel, { color: iconColor }]}>
                            {item.label}:
                          </ThemedText>
                          <ThemedText style={styles.propertyValue}>{item.value}</ThemedText>
                        </View>
                      ))}
                    </>
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
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
    height: 250,
  },
  compoundsListContent: {
    paddingBottom: 8,
  },
  loadingMoreContainer: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  loadingMoreText: {
    marginTop: 8,
    fontSize: 12,
    opacity: 0.7,
  },
  endOfListText: {
    fontSize: 12,
    opacity: 0.5,
    fontStyle: 'italic',
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
  },
  modalContent: {
    width: '90%',
    height: '55%',      // fixed card height so ScrollView has space
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
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalBodyContent: {
    paddingBottom: 16,
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
  referencesSection: {
    marginTop: 16,
  },
  referencesLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  referencesLoadingText: {
    fontSize: 13,
    opacity: 0.7,
  },
  referencesEmpty: {
    fontSize: 13,
    opacity: 0.6,
    fontStyle: 'italic',
    marginTop: 4,
  },
  referencesList: {
    marginTop: 4,
    gap: 8,
  },
  referenceItem: {
    marginBottom: 6,
  },
  referenceKey: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  referenceText: {
    fontSize: 13,
    opacity: 0.85,
  },
  refsButton: {
    marginRight: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  refsButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
});