import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export interface RadarChartItem {
  key: string;
  label: string;
  shortLabel?: string;
  icon?: string;
  weight: number; // 0.00 to 1.00
}

interface RadarChartProps {
  items: readonly RadarChartItem[];
  size?: number;
}

const SHORT_LABELS: Record<string, string> = {
  // Food
  cafes_bakeries_sweets: 'Cafes & Sweets',
  east_southeast_asian: 'East Asian',
  western_european_mediterranean: 'Western & Med',
  latin_south_american_bbq: 'Latin & BBQ',
  south_asian_middle_eastern_african: 'South Asian',
  quick_bites_fast_food: 'Quick Bites',
  bars_pubs_breweries: 'Bars & Pubs',
  steak_seafood_specialty: 'Steak & Seafood',
  healthy_vegan_fusion: 'Healthy & Vegan',
  casual_fine_dining: 'Fine Dining',
  // Activities
  nature_parks_outdoors: 'Nature',
  culture_history_museums: 'Culture',
  amusement_games_fun: 'Amusement',
  arts_shows_music: 'Arts & Music',
  adventure_sports_recreation: 'Adventure',
  social_nightlife_venues: 'Nightlife',
};

export function RadarChart({ items, size = 320 }: RadarChartProps) {
  const theme = useTheme();

  const chartData = useMemo(() => {
    const count = items.length;
    if (count < 3) return null;

    const width = size;
    const height = size * 0.95;
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(cx, cy) * 0.60;
    const labelRadius = radius + 24;

    const angles = items.map((_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / count);

    // Grid levels (20%, 40%, 60%, 80%, 100%)
    const levels = [0.2, 0.4, 0.6, 0.8, 1.0];
    const gridPolygons = levels.map((lvl) => {
      const pts = angles
        .map((ang) => {
          const x = cx + radius * lvl * Math.cos(ang);
          const y = cy + radius * lvl * Math.sin(ang);
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');
      return { level: lvl, points: pts };
    });

    // Spokes from center to vertex at radius
    const spokes = angles.map((ang) => ({
      x1: cx,
      y1: cy,
      x2: cx + radius * Math.cos(ang),
      y2: cy + radius * Math.sin(ang),
    }));

    // Data polygon
    const dataPointsArray = items.map((item, i) => {
      const ang = angles[i];
      const r = Math.max(0.04, Math.min(1, item.weight)) * radius;
      return {
        x: cx + r * Math.cos(ang),
        y: cy + r * Math.sin(ang),
        weight: item.weight,
      };
    });

    const dataPolygonPoints = dataPointsArray
      .map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
      .join(' ');

    // Labels positioned around the outer rim
    const labels = items.map((item, i) => {
      const ang = angles[i];
      const lx = cx + labelRadius * Math.cos(ang);
      const ly = cy + labelRadius * Math.sin(ang);

      const cos = Math.cos(ang);
      let textAnchor: 'start' | 'middle' | 'end' = 'middle';
      if (cos > 0.25) textAnchor = 'start';
      else if (cos < -0.25) textAnchor = 'end';

      const short = item.shortLabel ?? SHORT_LABELS[item.key] ?? item.label;

      return {
        key: item.key,
        text: short,
        x: lx,
        y: ly + 4,
        textAnchor,
      };
    });

    return {
      width,
      height,
      cx,
      cy,
      radius,
      gridPolygons,
      spokes,
      dataPointsArray,
      dataPolygonPoints,
      labels,
    };
  }, [items, size]);

  if (!chartData) return null;

  return (
    <View style={styles.container}>
      <Svg
        width={chartData.width}
        height={chartData.height}
        viewBox={`0 0 ${chartData.width} ${chartData.height}`}
      >
        {/* Concentric grid polygons */}
        {chartData.gridPolygons.map((gp, idx) => (
          <Polygon
            key={`grid-${idx}`}
            points={gp.points}
            fill="none"
            stroke={theme.border}
            strokeWidth={idx === chartData.gridPolygons.length - 1 ? '1.5' : '1'}
            opacity={idx === chartData.gridPolygons.length - 1 ? 0.9 : 0.45}
          />
        ))}

        {/* Radial spokes */}
        {chartData.spokes.map((spoke, idx) => (
          <Line
            key={`spoke-${idx}`}
            x1={spoke.x1}
            y1={spoke.y1}
            x2={spoke.x2}
            y2={spoke.y2}
            stroke={theme.border}
            strokeWidth="1"
            opacity={0.5}
          />
        ))}

        {/* Data polygon with translucent fill and accent stroke */}
        <Polygon
          points={chartData.dataPolygonPoints}
          fill={theme.primary}
          fillOpacity={0.22}
          stroke={theme.primary}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Vertex markers for points with affinity */}
        {chartData.dataPointsArray.map((pt, idx) => {
          if (pt.weight <= 0) return null;
          return (
            <Circle
              key={`dot-${idx}`}
              cx={pt.x}
              cy={pt.y}
              r={4}
              fill={theme.primary}
              stroke={theme.background}
              strokeWidth="1.5"
            />
          );
        })}

        {/* Outer Axis Category Labels */}
        {chartData.labels.map((lbl) => (
          <SvgText
            key={`lbl-${lbl.key}`}
            x={lbl.x}
            y={lbl.y}
            textAnchor={lbl.textAnchor}
            fontSize="10.5"
            fontWeight="600"
            fill={theme.textSecondary}
          >
            {lbl.text}
          </SvgText>
        ))}
      </Svg>

      {/* Legend row matching Hevy screenshot */}
      <View style={styles.legendRow}>
        <View style={[styles.legendDot, { backgroundColor: theme.primary }]} />
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.legendText}>
          Current
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 6,
    marginBottom: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
  },
});
