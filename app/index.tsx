import { SpectrumDashboard } from '@/components/pages/spectrum-dashboard';
import { getDatabaseCategories } from '@/lib/database';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

export default function HomeScreen() {
  const [databases, setDatabases] = useState<{ name: string; count: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDatabases = async () => {
      try {
        const dbList = await getDatabaseCategories();
        setDatabases(dbList);
      } catch (error) {
        console.error('Error loading databases:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDatabases();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return <SpectrumDashboard databases={databases} />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
