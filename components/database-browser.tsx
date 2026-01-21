import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useThemeColor } from '../hooks/use-theme-color';
import { Compound, getCompoundsByDatabase, searchCompoundsInDatabase } from '../lib/database';
import { SelectedSpectrum } from '../lib/types';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

interface DatabaseBrowserProps {
  onSpectrumAdd: (spectrum: { compound: Compound; type: 'absorption' | 'emission' }) => void;
  onSpectrumRemove: (compoundId: string, type: 'absorption' | 'emission') => void;
  selectedSpectra: SelectedSpectrum[];
  databases: { name: string; count: number }[];
}

export function DatabaseBrowser({ onSpectrumAdd, onSpectrumRemove, selectedSpectra, databases }: DatabaseBrowserProps) {
  const [selectedDatabase, setSelectedDatabase] = useState<string | null>(null);
  const [compounds, setCompounds] = useState<Compound[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const selectedCompoundIds = new Set(
    selectedSpectra.map(s => s.compound.id)
  );

  const loadCompounds = async (databaseName: string, query: string = '') => {
    setIsLoading(true);
    try {
      let results: Compound[];
      if (query.trim()) {
        results = await searchCompoundsInDatabase(databaseName, query);
      } else {
        results = await getCompoundsByDatabase(databaseName, 50);
      }
      setCompounds(results);
    } catch (error) {
      console.error('Error loading compounds:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDatabase) {
      loadCompounds(selectedDatabase, searchQuery);
    }
  }, [selectedDatabase, searchQuery]);

  const handleDatabaseSelect = (databaseName: string) => {
    setSelectedDatabase(databaseName);
    setSearchQuery('');
  };

  const handleCompoundSelect = (compound: Compound) => {
    // Toggle absorption
    const hasAbsorption = selectedSpectra.some(
      s => s.compound.id === compound.id && s.type === 'absorption'
    );
    if (hasAbsorption) {
      onSpectrumRemove(compound.id, 'absorption');
    } else if (compound.has_absorption_data === '1') {
      onSpectrumAdd({ compound, type: 'absorption' });
    }

    // Toggle emission
    const hasEmission = selectedSpectra.some(
      s => s.compound.id === compound.id && s.type === 'emission'
    );
    if (hasEmission) {
      onSpectrumRemove(compound.id, 'emission');
    } else if (compound.has_emission_data === '1') {
      onSpectrumAdd({ compound, type: 'emission' });
    }
  };

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

    return (
      <View style={styles.compoundItem}>
        <View style={styles.compoundInfo}>
          <ThemedText style={styles.compoundName}>{compound.name}</ThemedText>
          <ThemedText style={[styles.compoundId, { color: iconColor }]}>{compound.id}</ThemedText>
        </View>
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
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <ThemedText type="title" style={styles.title}>Database Browser</ThemedText>

      {/* Database Selection */}
      <View style={styles.section}>
        <ThemedText style={[styles.sectionTitle, { color: iconColor }]}>Select Database</ThemedText>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={databases}
          keyExtractor={(item) => item.name}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.databaseButton,
                selectedDatabase === item.name && styles.databaseButtonSelected
              ]}
              onPress={() => handleDatabaseSelect(item.name)}
            >
              <ThemedText
                style={[
                  styles.databaseButtonText,
                  selectedDatabase === item.name && styles.databaseButtonTextSelected
                ]}
              >
                {item.name} ({item.count})
              </ThemedText>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Search */}
      {selectedDatabase && (
        <View style={styles.section}>
          <TextInput
            style={[styles.searchInput, { borderColor: iconColor, color: textColor }]}
            placeholder="Search compounds..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={iconColor}
          />
        </View>
      )}

      {/* Compounds List */}
      {selectedDatabase && (
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
      )}

    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 8,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
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
  databaseButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  databaseButtonSelected: {
    backgroundColor: '#3b82f6',
  },
  databaseButtonText: {
    fontSize: 12,
    color: '#333',
  },
  databaseButtonTextSelected: {
    color: '#fff',
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
});
