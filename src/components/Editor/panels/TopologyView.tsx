import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { analyzeTopology } from '../../../core/analysis/topology';
import { useStore } from '../../../core/store/store';
import type { FlowNode } from '../../../core/types';
import { useT } from '../../../lib/useT';
import { cn } from '../../../lib/utils';

const VIEW_W = 720;
const VIEW_H = 340;
const R = 25;

function initialLayout(nodes: FlowNode[]): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  const count = nodes.length;
  if (count === 0) return positions;
  if (count <= 9) {
    const radius = Math.min(112, 54 + count * 11);
    nodes.forEach((node, index) => {
      const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
      positions[node.id] = {
        x: VIEW_W / 2 + Math.cos(angle) * radius,
        y: VIEW_H / 2 + Math.sin(angle) * radius,
      };
    });
    return positions;
  }
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const gapX = (VIEW_W - 120) / Math.max(cols - 1, 1);
  const gapY = (VIEW_H - 90) / Math.max(rows - 1, 1);
  nodes.forEach((node, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    positions[node.id] = { x: 60 + col * gapX, y: 45 + row * gapY };
  });
  return positions;
}

export function TopologyView() {
  const t = useT();
  const locale = useStore((state) => state.settings.locale);
  const mode = useStore((state) => state.theme.mode);
  const project = useStore((state) => state.projects.find((entry) => entry.id === state.activeProjectId));
  const rules = project?.rules ?? [];
  const tags = project?.tags ?? [];
  const light = mode === 'light';

  const { data, warnings } = useMemo(() => analyzeTopology(rules, tags, locale), [rules, tags, locale]);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [zoom, setZoom] = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);

  useEffect(() => {
    setPositions(initialLayout(data.nodes));
  }, [data.nodes]);

  const toView = (event: React.PointerEvent | React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * VIEW_W,
      y: ((event.clientY - rect.top) / rect.height) * VIEW_H,
    };
  };

  const nodeById = new Map(data.nodes.map((node) => [node.id, node]));
  const cycleEdges = new Set(warnings.flatMap((warning) => (warning.kind === 'cycle' ? warning.ruleIds : [])));

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-2.5 py-1.5">
        <span className="text-[10px] font-medium text-ink">{t('topology.title')}</span>
        <span className="hidden truncate text-[9px] text-faint sm:block">{t('topology.hint')}</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setZoom((value) => Math.max(0.6, Number((value - 0.15).toFixed(2))))}
          className="rounded border border-line p-0.5 text-faint hover:text-ink"
          aria-label={t('topology.zoomOut')}
        >
          <ZoomOut size={11} />
        </button>
        <span className="w-8 text-center text-[9px] text-faint">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          onClick={() => setZoom((value) => Math.min(1.6, Number((value + 0.15).toFixed(2))))}
          className="rounded border border-line p-0.5 text-faint hover:text-ink"
          aria-label={t('topology.zoomIn')}
        >
          <ZoomIn size={11} />
        </button>
        <button
          type="button"
          onClick={() => {
            setZoom(1);
            setPositions(initialLayout(data.nodes));
          }}
          className="rounded border border-line p-0.5 text-faint hover:text-ink"
          aria-label={t('topology.fit')}
        >
          <Maximize2 size={11} />
        </button>
      </div>

      {warnings.length > 0 ? (
        <div className="shrink-0 space-y-1 border-b border-line/60 bg-danger/5 px-3 py-1.5">
          {warnings.map((warning, index) => (
            <p
              key={`${warning.kind}-${index}`}
              className={cn(
                'text-[9px] leading-relaxed',
                warning.kind === 'cycle' ? 'text-danger' : warning.kind === 'busy' ? 'text-warn' : 'text-muted',
              )}
            >
              {warning.message}
            </p>
          ))}
        </div>
      ) : null}

      {data.nodes.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
          <Maximize2 size={20} className="text-faint" />
          <p className="max-w-[260px] text-[10px] leading-relaxed text-faint">{t('topology.empty')}</p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            className="h-full w-full touch-none"
            onPointerDown={(event) => {
              event.preventDefault();
            }}
            onPointerMove={(event) => {
              const drag = dragRef.current;
              if (!drag) return;
              event.preventDefault();
              const point = toView(event);
              setPositions((value) => ({
                ...value,
                [drag.id]: { x: point.x - drag.dx, y: point.y - drag.dy },
              }));
            }}
            onPointerUp={(event) => {
              event.preventDefault();
              dragRef.current = null;
            }}
            onPointerLeave={() => {
              dragRef.current = null;
            }}
          >
            <defs>
              <marker id="sfm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
              </marker>
              <marker id="sfm-arrow-danger" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#f87171" />
              </marker>
            </defs>
            <g transform={`translate(${(VIEW_W * (1 - zoom)) / 2} ${(VIEW_H * (1 - zoom)) / 2}) scale(${zoom})`}>
              {data.edges.map((edge) => {
                const from = positions[edge.from];
                const to = positions[edge.to];
                if (!from || !to) return null;
                const dx = to.x - from.x;
                const dy = to.y - from.y;
                const distance = Math.hypot(dx, dy) || 1;
                const startX = from.x + (dx / distance) * R;
                const startY = from.y + (dy / distance) * R;
                const endX = to.x - (dx / distance) * (R + 4);
                const endY = to.y - (dy / distance) * (R + 4);
                const midX = (startX + endX) / 2;
                const midY = (startY + endY) / 2;
                const curveX = midX + (dy / distance) * 18;
                const curveY = midY - (dx / distance) * 18;
                const isCycle = cycleEdges.has(edge.ruleId);
                return (
                  <g key={edge.id}>
                    <path
                      d={`M ${startX} ${startY} Q ${curveX} ${curveY} ${endX} ${endY}`}
                      fill="none"
                      stroke={isCycle ? '#f87171' : light ? '#94a3b8' : '#475569'}
                      strokeWidth={isCycle ? 1.6 : 1}
                      strokeDasharray="4 3"
                      markerEnd={`url(#${isCycle ? 'sfm-arrow-danger' : 'sfm-arrow'})`}
                      opacity={0.8}
                    >
                      <animate attributeName="stroke-dashoffset" from="14" to="0" dur="1.4s" repeatCount="indefinite" />
                    </path>
                    {edge.label ? (
                      <text x={curveX} y={curveY} textAnchor="middle" fontSize={7} fill={light ? '#64748b' : '#94a3b8'}>
                        {edge.label}
                      </text>
                    ) : null}
                  </g>
                );
              })}

              {data.nodes.map((node) => {
                const position = positions[node.id];
                if (!position) return null;
                return (
                  <g
                    key={node.id}
                    transform={`translate(${position.x} ${position.y})`}
                    className="cursor-grab active:cursor-grabbing"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      event.currentTarget.setPointerCapture(event.pointerId);
                      const point = toView(event);
                      dragRef.current = { id: node.id, dx: point.x - position.x, dy: point.y - position.y };
                    }}
                  >
                    <circle r={R} fill={light ? '#ffffff' : '#0f1319'} stroke={node.color} strokeWidth={1.4} />
                    <circle r={R - 5} fill={node.color} opacity={0.08} />
                    <text
                      textAnchor="middle"
                      y={3}
                      fontSize={9}
                      fill={light ? '#1e293b' : '#e5e7eb'}
                      className="pointer-events-none select-none"
                    >
                      {node.label.replace(/^(tag|block):/, '').length > 14
                        ? `${node.label.replace(/^(tag|block):/, '').slice(0, 13)}…`
                        : node.label.replace(/^(tag|block):/, '')}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      )}

      <div className="flex shrink-0 items-center gap-3 border-t border-line/60 px-3 py-1 text-[9px] text-faint">
        <span>{data.nodes.length} nodes</span>
        <span>{data.edges.length} edges</span>
        {warnings.some((warning) => warning.kind === 'cycle') ? (
          <span className="text-danger">{t('topology.deadlock')}</span>
        ) : (
          <span className="text-ok">{t('topology.ok')}</span>
        )}
        <span className="ml-auto">{nodeById.size} refs</span>
      </div>
    </div>
  );
}
