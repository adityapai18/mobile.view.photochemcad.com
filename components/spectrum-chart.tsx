import { matchFont, Skia, Line as SkiaLine, Text as SkiaText } from '@shopify/react-native-skia';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CartesianAxis, CartesianChart, Line } from 'victory-native';
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

  const tickFont = useMemo(() => matchFont({ fontFamily: 'System', fontSize: 10 }), []);
  const axisFont = useMemo(
    () => matchFont({ fontFamily: 'System', fontSize: 11, fontWeight: '600' }),
    [],
  );

  // ✅ RN colors -> Skia colors (fixes invisible SkiaText / axis labels)
  const skTextColor = useMemo(() => Skia.Color(String(textColor)), [textColor]);
  const skIconColor = useMemo(() => Skia.Color(String(iconColor)), [iconColor]);

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
      <View style={[styles.container, { backgroundColor }]}>
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
      <View style={[styles.container, { backgroundColor }]}>
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
      <View style={[styles.container, { backgroundColor }]}>
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
    <View style={[styles.container, { backgroundColor }]}>
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
          renderOutside={({ chartBounds, xScale, yScale, xTicks, yTicks }) => {
            const xTickValues =
              xTicks && xTicks.length > 0
                ? xTicks
                : typeof xScale.ticks === 'function'
                  ? xScale.ticks()
                  : [];
            const yTickValues =
              yTicks && yTicks.length > 0
                ? yTicks
                : typeof yScale.ticks === 'function'
                  ? yScale.ticks(5)
                  : [];

            return (
              <>
                {/* Y tick labels + tick marks */}
                {yTickValues.map((tick: number) => {
                  const y = yScale(tick);
                  if (y < chartBounds.top - 8 || y > chartBounds.bottom + 8) return null;

                  return (
                    <React.Fragment key={`y-tick-${tick}`}>
                      <SkiaLine
                        p1={{ x: chartBounds.left - 8, y }}
                        p2={{ x: chartBounds.left, y }}
                        color={skIconColor}
                        strokeWidth={1}
                      />
                      <SkiaText
                        x={4}
                        y={y + 4}
                        text={Number(tick).toFixed(2)}
                        font={tickFont}
                        color={skTextColor}
                      />
                    </React.Fragment>
                  );
                })}

                {/* X tick labels + tick marks */}
                {xTickValues.map((tick: number) => {
                  const x = xScale(tick);
                  if (x < chartBounds.left - 12 || x > chartBounds.right + 12) return null;

                  const labelX = Math.max(chartBounds.left + 2, x - 12);

                  return (
                    <React.Fragment key={`x-tick-${tick}`}>
                      <SkiaLine
                        p1={{ x, y: chartBounds.bottom }}
                        p2={{ x, y: chartBounds.bottom + 8 }}
                        color={skIconColor}
                        strokeWidth={1}
                      />
                      <SkiaText
                        x={labelX}
                        y={chartBounds.bottom + 22}
                        text={Number(tick).toFixed(0)}
                        font={tickFont}
                        color={skTextColor}
                      />
                    </React.Fragment>
                  );
                })}

                {/* Axis titles */}
                <SkiaText
                  x={4}
                  y={chartBounds.top + 14}
                  text={isNormalized ? 'Norm' : 'Value'}
                  font={axisFont}
                  color={skTextColor}
                />

                <SkiaText
                  x={chartBounds.left + (chartBounds.right - chartBounds.left) / 2 - 60}
                  y={chartBounds.bottom + 36}
                  text="Wavelength (nm)"
                  font={axisFont}
                  color={skTextColor}
                />
              </>
            );
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
  container: {
    borderRadius: 8,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
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
