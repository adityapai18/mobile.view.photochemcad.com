import { useFont } from '@shopify/react-native-skia';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CartesianAxis, CartesianChart, Line, useChartTransformState } from 'victory-native';
import Mono from '../assets/fonts/Mono.ttf';
import { useThemeColor } from '../hooks/use-theme-color';
import { DistributionParams, SelectedSpectrum } from '../lib/types';

interface SpectrumChartProps {
  data: SelectedSpectrum[];
  isLoading?: boolean;
  distributions?: DistributionParams[];
}

const COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
];

const CHART_HEIGHT = 400;

export function SpectrumChart({ data, isLoading, distributions = [] }: SpectrumChartProps) {
  const [isNormalized, setIsNormalized] = useState(false);

  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({}, 'icon');

  const font = useFont(Mono, 12);

  const { state: transformState } = useChartTransformState({
    scaleX: 1.0, // Initial X-axis scale
    scaleY: 1.0, // Initial Y-axis scale
  });

  const normalizeValue = (value: number, min: number, max: number): number => {
    if (max === min) return 0.5;
    return (value - min) / (max - min);
  };

  /**
   * ✅ PERFORMANCE FIX:
   * Your previous approach did O(N^2) lookups via `.find()` per wavelength.
   * This builds a wavelength->value map once per spectrum, then constructs rows in O(N).
   */
  const chartData = useMemo(() => {
    if (data.length === 0) return [];

    // Collect all wavelengths across all spectra
    const allWavelengths = new Set<number>();
    for (const s of data) {
      for (const p of s.data) allWavelengths.add(p.wavelength);
    }
    const sortedWavelengths = Array.from(allWavelengths).sort((a, b) => a - b);

    // Pre-index each spectrum: wavelength -> value
    const spectrumValueByWL: Record<string, Map<number, number>> = {};
    const spectrumRanges: Record<string, { min: number; max: number }> = {};

    for (const { compound, type, data: spectrumData } of data) {
      const key = `${compound.id}-${type}`;
      const m = new Map<number, number>();
      const values: number[] = [];

      for (const p of spectrumData) {
        const raw = type === 'absorption' ? p.coefficient : p.normalized;
        if (raw === null || raw === undefined || Number.isNaN(raw)) continue;
        m.set(p.wavelength, raw);
        values.push(raw);
      }

      spectrumValueByWL[key] = m;

      if (isNormalized && values.length > 0) {
        spectrumRanges[key] = { min: Math.min(...values), max: Math.max(...values) };
      }
    }

    // Build rows for the chart
    return sortedWavelengths.map((wavelength) => {
      const row: Record<string, any> = { wavelength };

      for (const { compound, type } of data) {
        const key = `${compound.id}-${type}`;
        const v = spectrumValueByWL[key]?.get(wavelength);
        if (v === undefined) continue;

        if (isNormalized) {
          const r = spectrumRanges[key];
          row[key] = r ? normalizeValue(v, r.min, r.max) : v;
        } else {
          row[key] = v;
        }
      }

      return row;
    });
  }, [data, isNormalized]);

  const yKeys = useMemo(() => data.map(({ compound, type }) => `${compound.id}-${type}`), [data]);

  if (isLoading) {
    return (
      <View style={{ backgroundColor }}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: textColor }]}>Spectrum Comparison</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (data.length === 0) {
    return (
      <View style={[{ backgroundColor }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: textColor }]}>Spectrum Comparison</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyText}>Select spectra to view comparison</Text>
        </View>
      </View>
    );
  }

  const validData = useMemo(() => {
    return chartData.filter((point) =>
      yKeys.some((key) => {
        const v = point[key];
        return v !== null && v !== undefined && !Number.isNaN(v);
      }),
    );
  }, [chartData, yKeys]);

  const domain = useMemo(() => {
    if (validData.length === 0) return undefined;

    const allXValues = validData.map((p) => p.wavelength).filter(Number.isFinite);
    const allYValues = validData.flatMap((p) =>
      yKeys.map((k) => p[k]).filter((v) => v !== null && v !== undefined && Number.isFinite(v)),
    );

    if (allXValues.length === 0 || allYValues.length === 0) return undefined;

    let xMin = Math.min(...allXValues);
    let xMax = Math.max(...allXValues);
    let yMin = Math.min(...allYValues);
    let yMax = Math.max(...allYValues);

    if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || !Number.isFinite(yMin) || !Number.isFinite(yMax)) {
      return undefined;
    }

    // Avoid zero-size domains (can break ticks/lines)
    if (xMin === xMax) {
      xMin -= 1;
      xMax += 1;
    }
    if (yMin === yMax) {
      yMin -= 1;
      yMax += 1;
    }

    // Optional padding so lines aren't glued to edges
    const yPad = (yMax - yMin) * 0.04;
    return {
      x: [xMin, xMax] as [number, number],
      y: [yMin - yPad, yMax + yPad] as [number, number],
    };
  }, [validData, yKeys]);

  if (validData.length === 0 || domain === undefined) {
    return (
      <View style={{ backgroundColor }}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: textColor }]}>Spectrum Comparison</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyText}>No valid spectrum data available</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[{ backgroundColor }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: textColor }]}>Spectrum Comparison</Text>

        <TouchableOpacity
          style={[styles.button, { borderColor: iconColor }, isNormalized && styles.buttonActive]}
          onPress={() => setIsNormalized((prev) => !prev)}
        >
          <Text style={[styles.buttonText, { color: textColor }, isNormalized && styles.buttonTextActive]}>
            {isNormalized ? 'Raw Data' : 'Normalize'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.chartContainer}>
        <CartesianChart
          data={validData}
          xKey="wavelength"
          yKeys={yKeys}
          domain={domain}

          axisOptions={{
            font,
            labelColor: textColor
          }}
          
        >
          {({ points, xScale, yScale, xTicks, yTicks }) => {
            if (!xScale || !yScale) return null;

            return (
              <>
                <CartesianAxis
                  axisSide={{ x: 'bottom', y: 'left' }}
                  tickCount={5}
                  xScale={xScale}
                  yScale={yScale}
                  xTicksNormalized={xTicks}
                  yTicksNormalized={yTicks}
                  // CartesianAxis expects string colors; tick text is drawn via SkiaText in renderOutside.
                  labelColor={String(textColor)}
                  lineColor={String(iconColor)}
                  lineWidth={1.5}
                />

                {data.map(({ compound, type }, index) => {
                  const yKey = `${compound.id}-${type}`;
                  const color = COLORS[index % COLORS.length];
                  const linePoints = points[yKey] || [];
                  if (linePoints.length === 0) return null;

                  return (
                    <Line
                      key={yKey}
                      points={linePoints}
                      color={color}
                      strokeWidth={2}
                      curveType="linear"
                      animate={{ type: "timing", duration: 300 }}
                    />
                  );
                })}
              </>
            );
          }}
        </CartesianChart>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.legendContainer, { borderTopColor: iconColor }]}
      >
        <View style={styles.legend}>
          {data.map(({ compound, type }, index) => {
            const color = COLORS[index % COLORS.length];
            return (
              <View key={`legend-${compound.id}-${type}`} style={styles.legendItem}>
                <View style={[styles.legendLine, { backgroundColor: color }]} />
                <Text style={[styles.legendText, { color: textColor }]}>
                  {compound.name} ({type})
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
  },
  buttonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  buttonText: {
    fontSize: 12,
  },
  buttonTextActive: {
    color: '#fff',
  },
  chartContainer: {
    height: CHART_HEIGHT,
    width: '100%',
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    height: CHART_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#666',
  },
  emptyText: {
    color: '#666',
  },
  legendContainer: {
    marginTop: 16,
    borderTopWidth: 1,
    paddingTop: 12,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  legendLine: {
    width: 20,
    height: 2,
    marginRight: 8,
  },
  legendText: {
    fontSize: 12,
  },
});
