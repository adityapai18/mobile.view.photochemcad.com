import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Platform, StyleSheet, Switch, View } from 'react-native';

import { useAppColorScheme } from '@/components/providers/color-scheme-provider';

import { ThemedText } from '../themed-text';
import { PhotochemMark } from './photochem-mark';

const BRAND_BLUE = '#1E4B8F';
const BRAND_GOLD = '#EFC047';

export function BrandHeader({
  title = 'PhotochemCAD™',
}: {
  title?: string;
}) {
  const { colorScheme, toggleColorScheme } = useAppColorScheme();

  return (
    <View style={styles.wrap}>
      <View style={styles.topBar}>
        <View style={styles.left}>
          <PhotochemMark size={24} color={BRAND_GOLD} />
          <ThemedText style={styles.brandText}>{title}</ThemedText>
        </View>

        <View style={styles.right}>
          <Ionicons
            name={colorScheme === 'dark' ? 'moon-outline' : 'sunny-outline'}
            size={18}
            color="#FFFFFF"
            style={{ opacity: 0.9 }}
          />
          <Switch
            value={colorScheme === 'dark'}
            onValueChange={toggleColorScheme}
            trackColor={{ false: 'rgba(255,255,255,0.25)', true: 'rgba(239,192,71,0.55)' }}
            thumbColor={Platform.OS === 'android' ? (colorScheme === 'dark' ? BRAND_GOLD : '#FFFFFF') : undefined}
            ios_backgroundColor="rgba(255,255,255,0.25)"
            style={styles.switch}
            accessibilityLabel="Toggle dark mode"
          />
        </View>
      </View>

      {/* Gold accent like the website nav bar */}
      <View style={styles.goldBar} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  topBar: {
    backgroundColor: BRAND_BLUE,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goldBar: {
    height: 6,
    backgroundColor: BRAND_GOLD,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  switch: {
    transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }],
  },
});

