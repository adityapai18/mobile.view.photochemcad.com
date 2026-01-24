import { Circle, Group, Line as SkiaLine, Text as SkiaText, useFont } from '@shopify/react-native-skia';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CartesianAxis, CartesianChart, Line, useChartPressState, type PointsArray } from 'victory-native';
import Mono from '../assets/fonts/Mono.ttf';
import { useThemeColor } from '../hooks/use-theme-color';
import { calculateDistribution } from '../lib/distributions';
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

function interpDist(points: { wavelength: number; intensity: number }[], w: number): number {
  if (points.length === 0) return 0;
  const first = points[0].wavelength;
  const last = points[points.length - 1].wavelength;
  if (w < first || w > last) return 0;
  if (points.length === 1) return points[0].intensity;
  let lo = 0;
  let hi = points.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].wavelength === w) return points[mid].intensity;
    if (points[mid].wavelength > w) hi = mid - 1;
    else lo = mid + 1;
  }
  const M = points[hi];
  const N = points[lo];
  if (N.wavelength === M.wavelength) return M.intensity;
  const t = (w - M.wavelength) / (N.wavelength - M.wavelength);
  return M.intensity + t * (N.intensity - M.intensity);
}

/** Interpolate spectrum (w, v) at wavelength w. Returns 0 outside range. */
function interpSpectrum(points: { w: number; v: number }[], wavelength: number): number {
  if (points.length === 0) return 0;
  const first = points[0].w;
  const last = points[points.length - 1].w;
  if (wavelength < first || wavelength > last) return 0;
  if (points.length === 1) return points[0].v;
  let lo = 0;
  let hi = points.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].w === wavelength) return points[mid].v;
    if (points[mid].w > wavelength) hi = mid - 1;
    else lo = mid + 1;
  }
  const M = points[hi];
  const N = points[lo];
  if (N.w === M.w) return M.v;
  const t = (wavelength - M.w) / (N.w - M.w);
  return M.v + t * (N.v - M.v);
}

/** Draws a dashed series using Skia Line segments (avoids Path+DashPathEffect so compound lines stay solid). */
function DistributionLine({ points, color }: { points: PointsArray; color: string }) {
  const segments: React.ReactNode[] = [];
  for (let i = 0; i + 1 < points.length; i += 2) {
    const a = points[i];
    const b = points[i + 1];
    if (!a || !b || typeof a.y !== 'number' || typeof b.y !== 'number') continue;
    segments.push(
      <SkiaLine
        key={i}
        p1={{ x: a.x, y: a.y }}
        p2={{ x: b.x, y: b.y }}
        color={color}
        strokeWidth={1.5}
      />
    );
  }
  return <>{segments}</>;
}

export function SpectrumChart({ data, isLoading, distributions = [] }: SpectrumChartProps) {
  const [isNormalized, setIsNormalized] = useState(false);

  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({}, 'icon');

  const font = useFont(Mono, 12);
  const tooltipFont = useFont(Mono, 11);

  const normalizeValue = (value: number, min: number, max: number): number => {
    if (max === min) return 0.5;
    return (value - min) / (max - min);
  };

  const chartData = useMemo(() => {
    if (data.length === 0) return [];

    const specKeys = data.map(({ compound, type }) => `${compound.id}-${type}`);
    const allWavelengths = new Set<number>();
    for (const s of data) {
      for (const p of s.data) allWavelengths.add(p.wavelength);
    }

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

    // Ordered (w, v) per spectrum for interpolation at distribution-added wavelengths
    const spectrumOrdered: Record<string, { w: number; v: number }[]> = {};
    for (const key of Object.keys(spectrumValueByWL)) {
      spectrumOrdered[key] = Array.from(spectrumValueByWL[key].entries())
        .map(([w, v]) => ({ w, v }))
        .sort((a, b) => a.w - b.w);
    }

    // Build spectrum-only rows to get y range for scaling distributions
    const specRows = Array.from(allWavelengths).sort((a, b) => a - b).map((wavelength) => {
      const row: Record<string, number> = { wavelength };
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

    let specYVals: number[] = [];
    for (const r of specRows) {
      for (const k of specKeys) {
        const v = r[k];
        if (v != null && Number.isFinite(v)) specYVals.push(v);
      }
    }
    let yMin = specYVals.length > 0 ? Math.min(...specYVals) : 0;
    let yMax = specYVals.length > 0 ? Math.max(...specYVals) : 1;
    if (yMax === yMin) {
      yMin -= 0.5;
      yMax += 0.5;
    }

    // Add distribution wavelengths and compute scaled intensities
    const distPoints: { wavelength: number; intensity: number }[][] = [];
    for (const p of distributions) {
      const pts = calculateDistribution(p);
      distPoints.push(pts);
      for (const pt of pts) allWavelengths.add(pt.wavelength);
    }

    const sortedWavelengths = Array.from(allWavelengths).sort((a, b) => a - b);

    return sortedWavelengths.map((wavelength) => {
      const row: Record<string, any> = { wavelength };

      for (const { compound, type } of data) {
        const key = `${compound.id}-${type}`;
        let v = spectrumValueByWL[key]?.get(wavelength);
        if (v === undefined) v = interpSpectrum(spectrumOrdered[key] ?? [], wavelength);
        if (isNormalized) {
          const r = spectrumRanges[key];
          row[key] = r ? normalizeValue(v, r.min, r.max) : v;
        } else {
          row[key] = v;
        }
      }

      for (let i = 0; i < distPoints.length; i++) {
        const intensity = interpDist(distPoints[i], wavelength);
        row[`dist-${i}`] = yMin + intensity * (yMax - yMin);
      }

      return row;
    });
  }, [data, isNormalized, distributions]);

  const yKeys = useMemo(
    () => [
      ...data.map(({ compound, type }) => `${compound.id}-${type}`),
      ...distributions.map((_, i) => `dist-${i}`),
    ],
    [data, distributions]
  );

  // ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURNS
  // Compute validData and domain BEFORE conditional returns
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

  // Chart press state for tooltips
  const { state: chartPressState, isActive: isPressActive } = useChartPressState({
    x: validData.length > 0 ? validData[0].wavelength : 0,
    y: yKeys.reduce((acc, key) => {
      acc[key] = 0;
      return acc;
    }, {} as Record<string, number>),
  });

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
          chartPressState={chartPressState}
          
          axisOptions={{
            font,
            labelColor: textColor,
          }}
        >
          {({ points, xScale, yScale, xTicks, yTicks, chartBounds }) => {
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

                {distributions.map((d, i) => {
                  const yKey = `dist-${i}`;
                  const color = COLORS[(data.length + i) % COLORS.length];
                  const linePoints = points[yKey] || [];
                  if (linePoints.length === 0) return null;

                  return (
                    <DistributionLine
                      key={yKey}
                      points={linePoints}
                      color={color}
                    />
                  );
                })}

                {/* Tooltip - rendered inside chart bounds */}
                {isPressActive && tooltipFont && (
                  <Group>
                    {/* Vertical line at pressed x position */}
                    <SkiaLine
                      p1={{ x: chartPressState.x.position.value, y: chartBounds.top }}
                      p2={{ x: chartPressState.x.position.value, y: chartBounds.bottom }}
                      color={iconColor}
                      strokeWidth={1}
                      opacity={0.5}
                    />
                    {/* Tooltip background and text */}
                    <Group>
                      <SkiaLine
                        p1={{ 
                          x: chartPressState.x.position.value > chartBounds.right - 120 
                            ? chartBounds.right - 120 
                            : Math.max(chartBounds.left + 10, chartPressState.x.position.value), 
                          y: chartBounds.top + 10 
                        }}
                        p2={{ 
                          x: chartPressState.x.position.value > chartBounds.right - 120 
                            ? chartBounds.right - 10 
                            : Math.max(chartBounds.left + 10, chartPressState.x.position.value) + 110, 
                          y: chartBounds.top + 10 
                        }}
                        color={backgroundColor}
                        strokeWidth={30}
                        opacity={0.9}
                      />
                      {/* Tooltip text */}
                      <SkiaText
                        x={chartPressState.x.position.value > chartBounds.right - 120 
                          ? chartBounds.right - 115 
                          : Math.max(chartBounds.left + 15, chartPressState.x.position.value + 5)}
                        y={chartBounds.top + 20}
                        text={`λ: ${Number(chartPressState.x.value.value).toFixed(0)} nm`}
                        font={tooltipFont}
                        color={textColor}
                      />
                      {yKeys.map((key, index) => {
                        const yValue = chartPressState.y[key]?.value.value;
                        if (yValue === undefined || isNaN(yValue)) return null;
                        const spectrum = data.find((d) => `${d.compound.id}-${d.type}` === key);
                        if (!spectrum) return null;
                        return (
                          <SkiaText
                            key={key}
                            x={chartPressState.x.position.value > chartBounds.right - 120 
                              ? chartBounds.right - 115 
                              : Math.max(chartBounds.left + 15, chartPressState.x.position.value + 5)}
                            y={chartBounds.top + 33 + index * 13}
                            text={`${spectrum.compound.name.substring(0, 12)}: ${Number(yValue).toFixed(3)}`}
                            font={tooltipFont}
                            color={COLORS[index % COLORS.length]}
                          />
                        );
                      })}
                    </Group>
                    {/* Circles at intersection points */}
                    {yKeys.map((key, index) => {
                      const yPos = chartPressState.y[key]?.position;
                      if (!yPos) return null;
                      return (
                        <Circle
                          key={key}
                          cx={chartPressState.x.position.value}
                          cy={yPos.value}
                          r={4}
                          color={COLORS[index % COLORS.length]}
                        />
                      );
                    })}
                  </Group>
                )}
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
          {distributions.map((d, i) => {
            const color = COLORS[(data.length + i) % COLORS.length];
            const label = `${d.type} (${d.lowWavelength}–${d.highWavelength})`;
            return (
              <View key={`legend-dist-${i}`} style={styles.legendItem}>
                <View style={[styles.legendLine, { backgroundColor: color }]} />
                <Text style={[styles.legendText, { color: textColor }]}>{label}</Text>
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
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
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
