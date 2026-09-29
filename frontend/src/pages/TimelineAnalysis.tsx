import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { Activity, Clock, ShieldCheck, Camera } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useCaseStore } from '../store/useCaseStore';
import { VideoPlayerWithOverlay } from '../components/VideoPlayerWithOverlay';
import { TimelineEvent } from '../types';

export const TimelineAnalysis: React.FC = () => {
  const token = useAuthStore((state) => state.token);
  const { activeCase, timelineEvents, setTimelineEvents } = useCaseStore();

  const [temporalDrift, setTemporalDrift] = useState<number>(0.0);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);

  const fetchTimeline = async () => {
    if (!activeCase) return;
    try {
      const res = await fetch(`http://localhost:8000/api/timeline/${activeCase.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: TimelineEvent[] = await res.json();
        setTimelineEvents(data);
      }
    } catch (err) {
      console.error('Fetch timeline error:', err);
    }
  };

  useEffect(() => {
    fetchTimeline();
  }, [activeCase, token]);

  const handleUpdateDrift = async () => {
    if (!activeCase) return;
    try {
      const res = await fetch(`http://localhost:8000/api/timeline/drift?case_id=${activeCase.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          camera_channel: 1,
          temporal_offset_sec: temporalDrift,
        }),
      });
      if (res.ok) {
        fetchTimeline();
      }
    } catch (err) {
      console.error('Update drift error:', err);
    }
  };

  // Prepare chart data for Recharts
  const chartData = (timelineEvents.length > 0 ? timelineEvents : [
    { id: '1', camera_channel: 1, start_sec: 12.0, end_sec: 45.0, entity_class: 'Person', track_id: 'P-001', confidence_avg: 0.89, bounding_box: [120, 80, 280, 410] },
    { id: '2', camera_channel: 2, start_sec: 20.0, end_sec: 60.0, entity_class: 'Vehicle', track_id: 'V-001', confidence_avg: 0.94, bounding_box: [200, 150, 480, 380] },
    { id: '3', camera_channel: 3, start_sec: 35.0, end_sec: 75.0, entity_class: 'Face', track_id: 'F-001', confidence_avg: 0.91, bounding_box: [240, 100, 340, 220] }
  ]).map((ev) => ({
    name: `Cam 0${ev.camera_channel} (${ev.entity_class})`,
    start: ev.start_sec + temporalDrift,
    duration: ev.end_sec - ev.start_sec,
    entity: ev.entity_class,
    track: ev.track_id,
    conf: (ev.confidence_avg * 100).toFixed(1),
    original: ev
  }));

  return (
    <div className="p-6 space-y-6 max-w-[1800px] mx-auto font-sans">
      {/* Header Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-mono text-indigo-400 font-bold uppercase tracking-wider">
              Cross-Camera Chronometer
            </div>
            <h1 className="text-lg font-mono font-bold text-slate-100">
              Interactive Multi-Track Gantt Deck & Clock Drift Sync
            </h1>
          </div>
        </div>

        {/* Temporal Variance Slider Control */}
        <div className="flex items-center gap-4 bg-slate-950 px-4 py-2 rounded-lg border border-slate-800 font-mono text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Clock className="w-4 h-4 text-teal-400" />
            <span>Temporal Drift Variance:</span>
            <span className="text-teal-400 font-bold">{temporalDrift > 0 ? `+${temporalDrift.toFixed(2)}s` : `${temporalDrift.toFixed(2)}s`}</span>
          </div>
          <input
            type="range"
            min="-10.0"
            max="10.0"
            step="0.25"
            value={temporalDrift}
            onChange={(e) => setTemporalDrift(parseFloat(e.target.value))}
            className="w-32 accent-teal-400 cursor-pointer"
          />
          <button
            onClick={handleUpdateDrift}
            className="px-3 py-1 rounded bg-teal-500 text-slate-950 font-bold hover:bg-teal-400 transition-colors"
          >
            Apply Sync
          </button>
        </div>
      </div>

      {/* Recharts Gantt Chart Visualization */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 font-mono text-xs">
          <div className="flex items-center gap-2 font-bold text-slate-200 uppercase">
            <Camera className="w-4 h-4 text-teal-400" />
            <span>Multi-Track Timeline Sequence Chart</span>
          </div>
          <span className="text-slate-400">SMPTE TIME WINDOW: 00:00 → 02:00 MINS</span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{ top: 10, right: 30, left: 60, bottom: 20 }}
            >
              <XAxis type="number" domain={[0, 100]} unit="s" stroke="#64748b" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis type="category" dataKey="name" stroke="#64748b" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', borderRadius: '8px', fontSize: '11px', fontFamily: 'monospace' }}
                formatter={(value: any, name: any, item: any) => [`${value}s duration (Start: ${item.payload.start}s)`, `Track ${item.payload.track}`]}
              />
              <Bar dataKey="duration" stackId="a" fill="#4edea3" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.entity === 'Person' ? '#ef4444' : entry.entity === 'Vehicle' ? '#4edea3' : '#adc6ff'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Video Player Component with Overlays */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8">
          <VideoPlayerWithOverlay
            events={timelineEvents}
            activeTimestamp={selectedEvent ? selectedEvent.start_sec : 15.0}
          />
        </div>

        {/* Selected Track Event Inspector */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 font-mono text-xs">
          <div className="flex items-center gap-2 font-bold text-slate-200 uppercase border-b border-slate-800 pb-3">
            <ShieldCheck className="w-4 h-4 text-teal-400" />
            <span>Track Event Inspector</span>
          </div>

          <div className="space-y-3 text-slate-300">
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
              <div className="text-teal-400 font-bold">Target Person: P-001</div>
              <div>OSNet Vector: <span className="text-slate-400">[0.042, -0.198, 0.812, ...] (512-dim)</span></div>
              <div>Confidence: <span className="text-emerald-400 font-bold">89.0%</span></div>
              <div>FAISS Vector Search: <span className="text-teal-400 font-bold">IndexFlatIP Match</span></div>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
              <div className="text-emerald-400 font-bold">Target Vehicle: V-001</div>
              <div>Descriptors: <span className="text-slate-400">HSV Histogram + HOG Shape</span></div>
              <div>Confidence: <span className="text-emerald-400 font-bold">94.0%</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
