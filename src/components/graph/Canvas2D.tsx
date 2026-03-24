import React, { useRef, useEffect, useCallback, useState } from 'react';
import { evaluate2DPoints, evaluateParametricPoints, evaluatePolarPoints, extractBoundaryPoints, evaluatePiecewisePoints, extractPiecewiseBoundaryPoints, findIntersections, findPiecewiseIntersections, findCurveIntersections, Equation, InequalityType, BoundaryPoint, IntersectionPoint } from '@/lib/mathEngine';

interface Canvas2DProps {
  equations: Equation[];
  sliderValues: Record<string, number>;
}

interface ViewState {
  centerX: number;
  centerY: number;
  scale: number;
}

const Canvas2D: React.FC<Canvas2DProps> = ({ equations, sliderValues }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<ViewState>({ centerX: 0, centerY: 0, scale: 60 });
  const dragRef = useRef<{ dragging: boolean; lastX: number; lastY: number }>({
    dragging: false, lastX: 0, lastY: 0,
  });
  const rafRef = useRef<number>(0);
  const [, setTick] = useState(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const { centerX, centerY, scale } = viewRef.current;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = 'hsl(220, 22%, 8%)';
    ctx.fillRect(0, 0, w, h);

    const xMin = centerX - w / 2 / scale;
    const xMax = centerX + w / 2 / scale;
    const yMin = centerY - h / 2 / scale;
    const yMax = centerY + h / 2 / scale;

    drawGrid(ctx, w, h, xMin, xMax, yMin, yMax, scale, centerX, centerY);

    const originX = w / 2 - centerX * scale;
    const originY = h / 2 + centerY * scale;

    // Plot equations and collect point data for intersection detection
    const visibleEqs = equations.filter(eq => eq.visible && (eq.expression.trim() || (eq.type === 'piecewise' && eq.pieces?.some(p => p.expression.trim()))));
    const curvePoints: Map<string, { x: number; y: number }[]> = new Map();

    for (const eq of visibleEqs) {
      let points: { x: number; y: number }[];

      if (eq.type === 'parametric') {
        const xExpr = eq.expression;
        const yExpr = eq.parametricY || '';
        if (!xExpr || !yExpr) continue;
        points = evaluateParametricPoints(xExpr, yExpr, 0, 2 * Math.PI, sliderValues, 2000);
        curvePoints.set(eq.id, points);
        drawCurve(ctx, points, eq.color, w, h, scale, centerX, centerY, false);
      } else if (eq.type === 'polar') {
        points = evaluatePolarPoints(eq.expression, 0, 2 * Math.PI, sliderValues, 2000);
        curvePoints.set(eq.id, points);
        drawCurve(ctx, points, eq.color, w, h, scale, centerX, centerY, false);
      } else if (eq.type === 'inequality') {
        points = evaluate2DPoints(eq.expression, xMin - 1, xMax + 1, sliderValues, Math.min(2000, w * 2), eq.condition);
        drawInequalityShading(ctx, points, eq.color, eq.inequality || '>', w, h, scale, centerX, centerY);
        const isStrict = eq.inequality === '>' || eq.inequality === '<';
        drawCurve(ctx, points, eq.color, w, h, scale, centerX, centerY, isStrict);
        const ineqBoundaries = extractBoundaryPoints(eq.condition, eq.expression, sliderValues);
        drawBoundaryDots(ctx, ineqBoundaries, eq.color, w, h, scale, centerX, centerY);
      } else if (eq.type === 'piecewise' && eq.pieces && eq.pieces.length > 0) {
        const { points: pwPoints } = evaluatePiecewisePoints(eq.pieces, xMin - 1, xMax + 1, sliderValues, Math.min(2000, w * 2));
        curvePoints.set(eq.id, pwPoints);
        drawCurve(ctx, pwPoints, eq.color, w, h, scale, centerX, centerY, false);
        const pwBoundaries = extractPiecewiseBoundaryPoints(eq.pieces, sliderValues);
        drawBoundaryDots(ctx, pwBoundaries, eq.color, w, h, scale, centerX, centerY);
      } else {
        points = evaluate2DPoints(eq.expression, xMin - 1, xMax + 1, sliderValues, Math.min(2000, w * 2), eq.condition);
        drawCurve(ctx, points, eq.color, w, h, scale, centerX, centerY, false);
        const boundaries = extractBoundaryPoints(eq.condition, eq.expression, sliderValues);
        drawBoundaryDots(ctx, boundaries, eq.color, w, h, scale, centerX, centerY);
      }
    }

    // Find and draw intersection points between all visible curves
    for (let i = 0; i < visibleEqs.length; i++) {
      for (let j = i + 1; j < visibleEqs.length; j++) {
        const eqA = visibleEqs[i];
        const eqB = visibleEqs[j];
        let intersections: IntersectionPoint[] = [];

        const aIsXY = eqA.type === 'explicit' || eqA.type === 'inequality' || eqA.type === 'piecewise';
        const bIsXY = eqB.type === 'explicit' || eqB.type === 'inequality' || eqB.type === 'piecewise';

        if (aIsXY && bIsXY) {
          // Both are y=f(x) type — use bisection
          const hasPiecewise = eqA.type === 'piecewise' || eqB.type === 'piecewise';
          if (hasPiecewise) {
            intersections = findPiecewiseIntersections(eqA, eqB, xMin - 0.5, xMax + 0.5, sliderValues);
          } else {
            intersections = findIntersections(
              eqA.expression, eqB.expression,
              xMin - 0.5, xMax + 0.5, sliderValues,
              eqA.condition, eqB.condition
            );
          }
        } else {
          // At least one is parametric/polar — use geometric segment intersection
          const pts1 = curvePoints.get(eqA.id);
          const pts2 = curvePoints.get(eqB.id);
          if (pts1 && pts2) {
            intersections = findCurveIntersections(pts1, pts2);
          }
        }

        drawIntersectionPoints(ctx, intersections, w, h, scale, centerX, centerY);
      }
    }
  }, [equations, sliderValues]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      draw();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    return () => observer.disconnect();
  }, [draw]);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(draw);
  }, [draw]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = { dragging: true, lastX: e.clientX, lastY: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current.dragging) return;
    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    viewRef.current.centerX -= dx / viewRef.current.scale;
    viewRef.current.centerY += dy / viewRef.current.scale;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    setTick(t => t + 1);
  }, []);

  const handleMouseUp = useCallback(() => {
    dragRef.current.dragging = false;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { centerX, centerY, scale } = viewRef.current;
    const w = rect.width;
    const h = rect.height;

    const worldX = centerX + (mx - w / 2) / scale;
    const worldY = centerY - (my - h / 2) / scale;
    const newScale = Math.max(5, Math.min(5000, scale * factor));
    viewRef.current.scale = newScale;
    viewRef.current.centerX = worldX - (mx - w / 2) / newScale;
    viewRef.current.centerY = worldY + (my - h / 2) / newScale;
    setTick(t => t + 1);
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full relative cursor-crosshair">
      <canvas
        ref={canvasRef}
        className="graph-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />
    </div>
  );
};

// --- Drawing helpers ---

function drawGrid(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  xMin: number, xMax: number,
  yMin: number, yMax: number,
  scale: number,
  centerX: number, centerY: number
) {
  const targetGridPx = 80;
  const rawUnit = targetGridPx / scale;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawUnit)));
  const residual = rawUnit / magnitude;
  let gridUnit: number;
  if (residual <= 2) gridUnit = 2 * magnitude;
  else if (residual <= 5) gridUnit = 5 * magnitude;
  else gridUnit = 10 * magnitude;

  const originX = w / 2 - centerX * scale;
  const originY = h / 2 + centerY * scale;

  // Minor grid
  const minorUnit = gridUnit / 5;
  ctx.strokeStyle = 'hsl(220, 14%, 13%)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  const minorStartX = Math.floor(xMin / minorUnit) * minorUnit;
  for (let x = minorStartX; x <= xMax; x += minorUnit) {
    const px = originX + x * scale;
    ctx.moveTo(px, 0); ctx.lineTo(px, h);
  }
  const minorStartY = Math.floor(yMin / minorUnit) * minorUnit;
  for (let y = minorStartY; y <= yMax; y += minorUnit) {
    const py = originY - y * scale;
    ctx.moveTo(0, py); ctx.lineTo(w, py);
  }
  ctx.stroke();

  // Major grid
  ctx.strokeStyle = 'hsl(220, 14%, 18%)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const startX = Math.floor(xMin / gridUnit) * gridUnit;
  for (let x = startX; x <= xMax; x += gridUnit) {
    const px = originX + x * scale;
    ctx.moveTo(px, 0); ctx.lineTo(px, h);
  }
  const startY = Math.floor(yMin / gridUnit) * gridUnit;
  for (let y = startY; y <= yMax; y += gridUnit) {
    const py = originY - y * scale;
    ctx.moveTo(0, py); ctx.lineTo(w, py);
  }
  ctx.stroke();

  // Axes
  ctx.strokeStyle = 'hsl(220, 10%, 35%)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (originY >= 0 && originY <= h) { ctx.moveTo(0, originY); ctx.lineTo(w, originY); }
  if (originX >= 0 && originX <= w) { ctx.moveTo(originX, 0); ctx.lineTo(originX, h); }
  ctx.stroke();

  // Labels
  ctx.fillStyle = 'hsl(215, 12%, 45%)';
  ctx.font = '11px Inter, system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let x = startX; x <= xMax; x += gridUnit) {
    if (Math.abs(x) < gridUnit * 0.01) continue;
    const px = originX + x * scale;
    const ly = Math.min(Math.max(originY + 6, 4), h - 16);
    ctx.fillText(formatNumber(x), px, ly);
  }
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let y = startY; y <= yMax; y += gridUnit) {
    if (Math.abs(y) < gridUnit * 0.01) continue;
    const py = originY - y * scale;
    const lx = Math.min(Math.max(originX - 6, 30), w - 4);
    ctx.fillText(formatNumber(y), lx, py);
  }
}

function formatNumber(n: number): string {
  if (Math.abs(n) >= 1000 || (Math.abs(n) < 0.01 && n !== 0)) return n.toExponential(1);
  return parseFloat(n.toFixed(6)).toString();
}

function drawCurve(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  color: string,
  w: number, h: number,
  scale: number,
  centerX: number, centerY: number,
  dashed: boolean
) {
  if (points.length === 0) return;

  const originX = w / 2 - centerX * scale;
  const originY = h / 2 + centerY * scale;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (dashed) {
    ctx.setLineDash([8, 6]);
  } else {
    ctx.setLineDash([]);
  }

  let drawing = false;
  ctx.beginPath();

  for (const p of points) {
    const px = originX + p.x * scale;
    const py = originY - p.y * scale;

    if (isNaN(p.y) || !isFinite(p.y) || py < -1000 || py > h + 1000) {
      drawing = false;
      continue;
    }

    if (!drawing) {
      ctx.moveTo(px, py);
      drawing = true;
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawInequalityShading(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  color: string,
  inequality: InequalityType,
  w: number, h: number,
  scale: number,
  centerX: number, centerY: number
) {
  if (points.length === 0 || !inequality) return;

  const originX = w / 2 - centerX * scale;
  const originY = h / 2 + centerY * scale;
  const shadeAbove = inequality === '>' || inequality === '>=';

  // Parse color to get semi-transparent fill
  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = color;

  // Build segments of valid consecutive points
  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];

  for (const p of points) {
    if (isNaN(p.y) || !isFinite(p.y)) {
      if (current.length > 0) {
        segments.push(current);
        current = [];
      }
    } else {
      current.push(p);
    }
  }
  if (current.length > 0) segments.push(current);

  for (const seg of segments) {
    if (seg.length < 2) continue;

    ctx.beginPath();

    // Start from boundary edge
    const firstPx = originX + seg[0].x * scale;
    const firstPy = originY - seg[0].y * scale;
    const lastPx = originX + seg[seg.length - 1].x * scale;

    if (shadeAbove) {
      // Shade from curve UP to top of canvas
      ctx.moveTo(firstPx, firstPy);
      for (const p of seg) {
        ctx.lineTo(originX + p.x * scale, originY - p.y * scale);
      }
      ctx.lineTo(lastPx, 0);
      ctx.lineTo(firstPx, 0);
    } else {
      // Shade from curve DOWN to bottom of canvas
      ctx.moveTo(firstPx, firstPy);
      for (const p of seg) {
        ctx.lineTo(originX + p.x * scale, originY - p.y * scale);
      }
      ctx.lineTo(lastPx, h);
      ctx.lineTo(firstPx, h);
    }

    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawBoundaryDots(
  ctx: CanvasRenderingContext2D,
  boundaries: BoundaryPoint[],
  color: string,
  w: number, h: number,
  scale: number,
  centerX: number, centerY: number
) {
  if (boundaries.length === 0) return;

  const originX = w / 2 - centerX * scale;
  const originY = h / 2 + centerY * scale;
  const radius = 5;

  for (const bp of boundaries) {
    const px = originX + bp.x * scale;
    const py = originY - bp.y * scale;

    if (px < -20 || px > w + 20 || py < -20 || py > h + 20) continue;

    ctx.beginPath();
    ctx.arc(px, py, radius, 0, 2 * Math.PI);

    if (bp.inclusive) {
      // Filled dot — point is included
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      // Hollow circle — point is excluded
      ctx.fillStyle = 'hsl(220, 22%, 8%)';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }
}

function drawIntersectionPoints(
  ctx: CanvasRenderingContext2D,
  points: IntersectionPoint[],
  w: number, h: number,
  scale: number,
  centerX: number, centerY: number
) {
  if (points.length === 0) return;

  const originX = w / 2 - centerX * scale;
  const originY = h / 2 + centerY * scale;
  const radius = 5;

  for (const p of points) {
    const px = originX + p.x * scale;
    const py = originY - p.y * scale;

    if (px < -50 || px > w + 50 || py < -50 || py > h + 50) continue;

    // White dot with dark outline
    ctx.beginPath();
    ctx.arc(px, py, radius + 1, 0, 2 * Math.PI);
    ctx.fillStyle = 'hsl(220, 22%, 8%)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(px, py, radius, 0, 2 * Math.PI);
    ctx.fillStyle = 'hsl(45, 100%, 60%)';
    ctx.fill();

    // Label with coordinates
    const label = `(${formatNum(p.x)}, ${formatNum(p.y)})`;
    ctx.font = '11px ui-monospace, monospace';
    const metrics = ctx.measureText(label);
    const labelW = metrics.width + 10;
    const labelH = 18;
    const lx = px + 10;
    const ly = py - 12;

    // Background pill
    ctx.fillStyle = 'hsla(220, 22%, 12%, 0.92)';
    ctx.beginPath();
    ctx.roundRect(lx - 5, ly - labelH / 2 - 1, labelW, labelH, 4);
    ctx.fill();
    ctx.strokeStyle = 'hsl(45, 100%, 60%)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Text
    ctx.fillStyle = 'hsl(45, 100%, 85%)';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, lx, ly);
  }
}

function formatNum(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  const s = n.toFixed(4);
  return s.replace(/0+$/, '').replace(/\.$/, '');
}

export default Canvas2D;
