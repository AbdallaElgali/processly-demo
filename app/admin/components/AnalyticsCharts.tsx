import { Box, Typography, useTheme } from '@mui/material';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import type { ChartPoint, OriginPoint, TooltipInfo } from '@/lib/analytics/charts';
import { tickAlias, tooltipInfo } from '@/lib/analytics/charts';
import { formatRate } from '@/lib/analytics/views';

interface TipProps {
  active?: boolean;
  payload?: readonly { payload?: { projectId?: string } }[];
}

/** The hovered project, found by id: never by the tick text. */
function PointTooltip({ active, payload, points, lines }: TipProps & { points: ChartPoint[]; lines: [string, (p: TooltipInfo) => string][] }) {
  const id = payload?.[0]?.payload?.projectId;
  const info = active && id ? tooltipInfo(points, id) : null;
  if (!info) return null;
  return (
    <Box sx={{ bgcolor: 'surface.raised', border: '1px solid', borderColor: 'border.subtle', borderRadius: 2, p: 1.5, fontSize: 12 }}>
      <Typography variant="subtitle2">{info.alias}</Typography>
      <Typography variant="caption" color="text.secondary" component="div">
        Approval v{info.version ?? '—'} · {info.approvedDate || '—'}
      </Typography>
      {lines.map(([label, get]) => (
        <div key={label}>{label}: {get(info)}</div>
      ))}
    </Box>
  );
}

function Frame({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) {
  return (
    <Box sx={{ flex: '1 1 420px', minWidth: 0, bgcolor: 'surface.panel', border: '1px solid', borderColor: 'border.subtle', borderRadius: 2, p: 2 }}>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>{title}</Typography>
      <Box sx={{ height: 280 }}>
        {empty ? <Typography variant="body2" color="text.secondary">No approved projects to chart yet.</Typography> : children}
      </Box>
    </Box>
  );
}

export function ScoreCharts({ points, viewLabel, compare }: { points: ChartPoint[]; viewLabel: string; compare: boolean }) {
  const v = useTheme().vars!.palette;
  const axis = v.text.secondary;
  const tick = (id: string) => tickAlias(points, id);
  const common = (
    <>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={v.border.subtle} />
      <XAxis dataKey="projectId" tickFormatter={tick} interval={0} angle={-25} textAnchor="end" height={64} fontSize={11} tick={{ fill: axis }} />
      <YAxis domain={[0, 1]} fontSize={12} tick={{ fill: axis }} />
      <Legend wrapperStyle={{ fontSize: 12 }} />
    </>
  );
  const f1Lines: [string, (p: TooltipInfo) => string][] = [[`${viewLabel} F1`, (i) => formatRate(i.f1)]];
  if (compare) f1Lines.push(['Right first time F1', (i) => formatRate(i.compareF1)]);
  return (
    <>
      <Frame title={`F1 · ${viewLabel}`} empty={points.length === 0}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 480, height: 280 }}>
          <LineChart data={points} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            {common}
            <RechartsTooltip content={<PointTooltip points={points} lines={f1Lines} />} />
            <Line name={viewLabel} dataKey="f1" type="monotone" stroke={v.accent.text} strokeWidth={3} dot={{ r: 4, fill: v.accent.text }} connectNulls={false} />
            {compare && <Line name="Right first time" dataKey="compareF1" type="monotone" stroke={v.status.warning} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3, fill: v.status.warning }} connectNulls={false} />}
          </LineChart>
        </ResponsiveContainer>
      </Frame>
      <Frame title={`Precision and recall · ${viewLabel}`} empty={points.length === 0}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 480, height: 280 }}>
          <LineChart data={points} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            {common}
            <RechartsTooltip content={<PointTooltip points={points} lines={[['Precision', (i) => formatRate(i.precision)], ['Recall', (i) => formatRate(i.recall)]]} />} />
            <Line name="Precision" dataKey="precision" type="monotone" stroke={v.status.info} strokeWidth={2} dot={{ r: 3, fill: v.status.info }} connectNulls={false} />
            <Line name="Recall" dataKey="recall" type="monotone" stroke={v.status.success} strokeWidth={2} dot={{ r: 3, fill: v.status.success }} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </Frame>
    </>
  );
}

export function OriginChart({ points }: { points: OriginPoint[] }) {
  const v = useTheme().vars!.palette;
  const axis = v.text.secondary;
  const alias = (id: string) => points.find((p) => p.projectId === id)?.alias ?? '';
  return (
    <Frame title="Where the approved values came from" empty={points.length === 0}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 480, height: 280 }}>
        <BarChart data={points} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={v.border.subtle} />
          <XAxis dataKey="projectId" tickFormatter={alias} interval={0} angle={-25} textAnchor="end" height={64} fontSize={11} tick={{ fill: axis }} />
          <YAxis allowDecimals={false} fontSize={12} tick={{ fill: axis }} />
          <RechartsTooltip labelFormatter={(id) => alias(String(id))} contentStyle={{ borderRadius: 8, borderColor: v.border.subtle, background: v.surface.raised, color: v.text.primary }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar name="AI" dataKey="ai" stackId="o" fill={v.status.info} />
          <Bar name="AI correction" dataKey="aiCorrection" stackId="o" fill={v.status.warning} />
          <Bar name="Entered by hand" dataKey="byHand" stackId="o" fill={v.status.success} />
        </BarChart>
      </ResponsiveContainer>
    </Frame>
  );
}
