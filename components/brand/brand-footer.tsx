import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

const BRAND_BLUE = '#1E4B8F';

export function BrandFooter() {
  return (
    <View style={styles.footer}>
      <ThemedText style={styles.footerText}>
        © 1998-2026 Lindsey, J. S.; Taniguchi, M.; Du, H.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    marginTop: 18,
    backgroundColor: BRAND_BLUE,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  footerText: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 12,
  },
});

