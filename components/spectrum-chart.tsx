import { matchFont, Text as SkiaText } from '@shopify/react-native-skia';
import React, { useMemo, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
const CHART_WIDTH = Dimensions.get('window').width;

export function SpectrumChart({ data, isLoading, distributions = [] }: SpectrumChartProps) {
  const [isNormalized, setIsNormalized] = useState(false);
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const iconColor = useThemeColor({}, 'icon');
  const tickFont = useMemo(() => matchFont({ fontFamily: 'System', fontSize: 10 }), []);
  const axisFont = useMemo(() => matchFont({ fontFamily: 'System', fontSize: 11, fontWeight: '600' }), []);

  // Helper function to normalize values to 0-1 scale
  const normalizeValue = (value: number, min: number, max: number): number => {
    if (max === min) return 0.5;
    return (value - min) / (max - min);
  };

  // Transform data for charts - flatten all points into a single array
  const chartData = useMemo(() => {
    if (data.length === 0) return [];

    // Get all unique wavelengths
    const allWavelengths = new Set<number>();
    data.forEach(({ data: spectrumData }) => {
      spectrumData.forEach(point => allWavelengths.add(point.wavelength));
    });

    const sortedWavelengths = Array.from(allWavelengths).sort((a, b) => a - b);

    // If normalization is enabled, find min/max for each spectrum
    const spectrumRanges: { [key: string]: { min: number; max: number } } = {};
    if (isNormalized) {
      data.forEach(({ compound, type, data: spectrumData }) => {
        const key = `${compound.id}-${type}`;
        const values = spectrumData.map(point => {
          const value = type === 'absorption' ? point.coefficient : point.normalized;
          return value || 0;
        }).filter(v => v !== null && v !== undefined);

        if (values.length > 0) {
          spectrumRanges[key] = {
            min: Math.min(...values),
            max: Math.max(...values)
          };
        }
      });
    }

    // Create data points - one object per wavelength with all spectrum values
    return sortedWavelengths.map(wavelength => {
      const dataPoint: any = { wavelength };
      
      data.forEach(({ compound, type, data: spectrumData }) => {
        const point = spectrumData.find(p => p.wavelength === wavelength);
        if (point) {
          let value = type === 'absorption' ? point.coefficient : point.normalized;
          
          // Normalize if enabled
          if (isNormalized && value !== null && value !== undefined) {
            const key = `${compound.id}-${type}`;
            const range = spectrumRanges[key];
            if (range) {
              value = normalizeValue(value, range.min, range.max);
            }
          }
          
          dataPoint[`${compound.id}-${type}`] = value;
        }
      });

      return dataPoint;
    });
  }, [data, isNormalized]);

  // Get all yKeys (one per spectrum)
  const yKeys = useMemo(() => {
    return data.map(({ compound, type }) => `${compound.id}-${type}`);
  }, [data]);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Spectrum Comparison</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (data.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Spectrum Comparison</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyText}>Select spectra to view comparison</Text>
        </View>
      </View>
    );
  }

  const validData = useMemo(() => {
    return chartData.filter(point => 
      yKeys.some(key => point[key] !== null && point[key] !== undefined && !isNaN(point[key]))
    );
  }, [chartData, yKeys]);
  
  // Calculate domain for safety
  const domain = useMemo(() => {
    if (validData.length === 0) return undefined;
    
    const allXValues = validData.map(p => p.wavelength).filter(v => !isNaN(v));
    const allYValues = validData.flatMap(point => 
      yKeys.map(key => point[key]).filter(v => v !== null && v !== undefined && !isNaN(v))
    );
    
    if (allXValues.length === 0 || allYValues.length === 0) return undefined;
    
    return {
      x: [Math.min(...allXValues), Math.max(...allXValues)] as [number, number],
      y: [Math.min(...allYValues), Math.max(...allYValues)] as [number, number]
    };
  }, [validData, yKeys]);
  
  if (validData.length === 0 || domain === undefined) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Spectrum Comparison</Text>
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
          onPress={() => setIsNormalized(!isNormalized)}
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
            padding={{ left: 60, right: 20, top: 20, bottom: 60 }}
            renderOutside={({ chartBounds, xScale, yScale, xTicks, yTicks }) => {
              return (
                <>
                  {yTicks.map((tick: number) => {
                    const y = yScale(tick);
                    if (y < chartBounds.top - 4 || y > chartBounds.bottom + 4) return null;
                    return (
                      <SkiaText
                        key={`y-tick-label-${tick}`}
                        x={4}
                        y={y + 4}
                        text={Number(tick).toFixed(2)}
                        font={tickFont}
                        color={textColor}
                      />
                    );
                  })}

                  {xTicks.map((tick: number) => {
                    const x = xScale(tick);
                    if (x < chartBounds.left - 8 || x > chartBounds.right + 8) return null;
                    return (
                      <SkiaText
                        key={`x-tick-label-${tick}`}
                        x={x - 12}
                        y={chartBounds.bottom + 18}
                        text={Number(tick).toFixed(0)}
                        font={tickFont}
                        color={textColor}
                      />
                    );
                  })}

                  <SkiaText
                    x={4}
                    y={chartBounds.top + 12}
                    text={isNormalized ? 'Norm' : 'Value'}
                    font={axisFont}
                    color={textColor}
                  />

                  <SkiaText
                    x={chartBounds.left + (chartBounds.right - chartBounds.left) / 2 - 48}
                    y={chartBounds.bottom + 38}
                    text="Wavelength (nm)"
                    font={axisFont}
                    color={textColor}
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
                    labelColor={textColor}
                    lineColor={iconColor}
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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.legendContainer, { borderTopColor: iconColor }]}>
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
    padding: 16,
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
  chartWrapper: {
    width: '100%',
  },
  yAxisLabelContainer: {
    position: 'absolute',
    left: 0,
    top: CHART_HEIGHT / 2 - 40,
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    transform: [{ rotate: '-90deg' }],
  },
  chartContainer: {
    height: CHART_HEIGHT,
    width: '100%',
    backgroundColor: 'transparent',
  },
  xAxisLabelContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
    marginLeft: 60,
  },
  axisLabel: {
    fontSize: 12,
    fontWeight: '600',
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
    color: '#666',
  },
  tickLabel: {
    position: 'absolute',
    fontSize: 10,
    opacity: 0.9,
  },
  axisTitle: {
    position: 'absolute',
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.9,
  },
});
