import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColor } from '../../hooks/use-theme-color';
import { Compound, getAbsorptionData, getEmissionData } from '../../lib/database';
import { SelectedSpectrum } from '../../lib/types';
import { DatabaseBrowser } from '../database-browser';
import { SpectrumChart } from '../spectrum-chart';
import { ThemedText } from '../themed-text';
import { ThemedView } from '../themed-view';

interface SpectrumDashboardProps {
  databases?: { name: string; count: number }[];
}

export function SpectrumDashboard({ databases = [] }: SpectrumDashboardProps) {
  const [selectedSpectra, setSelectedSpectra] = useState<SelectedSpectrum[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const backgroundColor = useThemeColor({}, 'background');

  const handleSpectrumAdd = async (spectrum: { compound: Compound; type: 'absorption' | 'emission' }) => {
    // Check if already selected
    const exists = selectedSpectra.some(
      s => s.compound.id === spectrum.compound.id && s.type === spectrum.type
    );
    if (exists) return;

    setIsLoading(true);
    try {
      // Fetch spectrum data
      let data;
      if (spectrum.type === 'absorption') {
        data = await getAbsorptionData(spectrum.compound.id);
      } else {
        data = await getEmissionData(spectrum.compound.id);
      }

      if (data && data.length > 0) {
        // Transform data to match SpectrumData interface
        const spectrumData = data.map((point: any) => ({
          compound_id: point.compound_id,
          wavelength: point.wavelength,
          coefficient: 'coefficient' in point ? point.coefficient : undefined,
          normalized: 'normalized' in point ? point.normalized : undefined,
        }));

        setSelectedSpectra(prev => [
          ...prev,
          {
            compound: spectrum.compound,
            type: spectrum.type,
            data: spectrumData,
          },
        ]);
      }
    } catch (error) {
      console.error('Error loading spectrum data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpectrumRemove = (compoundId: string, type: 'absorption' | 'emission') => {
    setSelectedSpectra(prev =>
      prev.filter(
        s => !(s.compound.id === compoundId && s.type === type)
      )
    );
  };

  // Prepare data for FlatList - each section is an item
  const listData = useMemo(() => [
    { id: 'browser', type: 'browser' as const },
    { id: 'selected', type: 'selected' as const },
    { id: 'chart', type: 'chart' as const },
  ], []);

  const renderHeader = () => (
    <ThemedView style={styles.header}>
      <View>
        <View style={styles.titleContainer}>
          <View style={styles.titleLine} />
          <View>
            <ThemedText type="title" style={styles.title}>Spectrum Comparison Dashboard</ThemedText>
            <ThemedText style={styles.subtitle}>
              Compare absorption and emission spectra from the PhotochemCAD database
            </ThemedText>
          </View>
        </View>
      </View>
    </ThemedView>
  );

  const renderItem = ({ item }: { item: { id: string; type: 'browser' | 'chart' | 'selected' } }) => {
    if (item.type === 'browser') {
      return (
        <View style={styles.browserContainer}>
          <DatabaseBrowser
            databases={databases}
            onSpectrumAdd={handleSpectrumAdd}
            onSpectrumRemove={handleSpectrumRemove}
            selectedSpectra={selectedSpectra}
          />
        </View>
      );
    }

    if (item.type === 'selected') {
      if (selectedSpectra.length === 0) return null;
      
      return (
        <View style={styles.selectedContainer}>
          <ThemedText type="subtitle" style={styles.selectedTitle}>
            Selected Spectra ({selectedSpectra.length})
          </ThemedText>
          <View style={styles.selectedList}>
            {selectedSpectra.map((item, index) => (
              <View key={`${item.compound.id}-${item.type}-${index}`} style={styles.selectedItem}>
                <ThemedText style={styles.selectedText} numberOfLines={1}>
                  {item.compound.name} ({item.type})
                </ThemedText>
                <TouchableOpacity
                  onPress={() => handleSpectrumRemove(item.compound.id, item.type)}
                  style={styles.removeButton}
                >
                  <ThemedText style={styles.removeText}>×</ThemedText>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      );
    }

    if (item.type === 'chart') {
      return (
        <View style={styles.chartContainer}>
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#3b82f6" />
            </View>
          )}
          <SpectrumChart
            data={selectedSpectra}
            isLoading={isLoading}
          />
        </View>
      );
    }

    return null;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
        style={{ backgroundColor }}
        scrollEnabled={true}
        removeClippedSubviews={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  titleLine: {
    width: 4,
    backgroundColor: '#3b82f6',
    marginRight: 12,
    borderRadius: 2,
  },
  title: {
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  content: {
    padding: 16,
  },
  browserContainer: {
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  selectedContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  selectedTitle: {
    marginBottom: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  selectedList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    maxWidth: '48%',
  },
  selectedText: {
    fontSize: 12,
    flex: 1,
    marginRight: 6,
  },
  removeButton: {
    padding: 2,
  },
  removeText: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: 'bold',
  },
  chartContainer: {
    position: 'relative',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    borderRadius: 8,
  },
});
