import FontAwesome from '@expo/vector-icons/FontAwesome';
import React from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * PhotochemCAD mark inspired by:
 * <span class="fa-stack" ...>
 *   <i class="fa fa-sun-o fa-stack-2x"></i>
 *   <i class="fa fa-circle fa-stack-1x"></i>
 * </span>
 */
export function PhotochemMark({
  size = 22,
  color = '#EFC047',
}: {
  size?: number;
  color?: string;
}) {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <FontAwesome
        name="sun-o"
        size={size}
        color={color}
        style={StyleSheet.absoluteFill}
      />
      <FontAwesome
        name="circle"
        size={Math.round(size * 0.45)}
        color={color}
        style={styles.inner}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    position: 'absolute',
  },
});

