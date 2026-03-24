import * as math from 'mathjs';

export type InequalityType = '>' | '<' | '>=' | '<=' | null;

export interface PiecewisePiece {
  expression: string;
  condition: string;
}

export interface Equation {
  id: string;
  expression: string;
  color: string;
  visible: boolean;
  type: 'explicit' | 'parametric' | 'polar' | 'inequality' | 'piecewise' | '3d';
  /** For parametric: "xExpr|yExpr" separated by pipe */
  parametricY?: string;
  /** Domain condition e.g. "x > 1", "x > 0 and x < 5" */
  condition?: string;
  /** Inequality operator for shaded region plotting */
  inequality?: InequalityType;
  /** Piecewise function pieces */
  pieces?: PiecewisePiece[];
  sliders: SliderDef[];
}

export interface SliderDef {
  name: string;
  min: number;
  max: number;
  value: number;
  step: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface SolveResult {
  type: 'roots' | 'derivative' | 'integral' | 'simplify' | 'system' | 'error';
  input: string;
  result: string;
  steps?: string[];
}

const EQUATION_COLORS = [
  'hsl(0, 85%, 60%)',     // red
  'hsl(210, 90%, 60%)',   // blue
  'hsl(142, 60%, 50%)',   // green
  'hsl(30, 90%, 55%)',    // orange
  'hsl(262, 60%, 58%)',   // purple
  'hsl(185, 80%, 50%)',   // cyan
  'hsl(330, 80%, 60%)',   // pink
  'hsl(50, 90%, 55%)',    // yellow
];

let colorIndex = 0;
export function getNextColor(): string {
  const c = EQUATION_COLORS[colorIndex % EQUATION_COLORS.length];
  colorIndex++;
  return c;
}

export function resetColorIndex() {
  colorIndex = 0;
}

// Preprocess expression to handle common math notations
function preprocessExpression(expr: string): string {
  let processed = expr.trim();

  // Remove y= or f(x)= prefix for explicit functions
  processed = processed.replace(/^[yf]\s*\(?\s*x?\s*\)?\s*=\s*/i, '');

  // Handle implicit multiplication: 2x -> 2*x, 3sin -> 3*sin
  processed = processed.replace(/(\d)([a-zA-Z(])/g, '$1*$2');
  // Handle )( -> )*(
  processed = processed.replace(/\)\(/g, ')*(');
  // Handle )(number
  processed = processed.replace(/\)(\d)/g, ')*$1');

  // Replace common notation
  processed = processed.replace(/\bln\b/g, 'log');
  processed = processed.replace(/√/g, 'sqrt');
  processed = processed.replace(/π/g, 'pi');
  processed = processed.replace(/θ/g, 'theta');

  return processed;
}

export function evaluateExpression(
  expr: string,
  scope: Record<string, number>
): number | null {
  try {
    const processed = preprocessExpression(expr);
    const result = math.evaluate(processed, scope);
    if (typeof result === 'number' && isFinite(result)) {
      return result;
    }
    return null;
  } catch {
    return null;
  }
}

export interface IntersectionPoint {
  x: number;
  y: number;
}

/**
 * Find intersection points between two explicit equations using sign-change detection + bisection.
 */
export function findIntersections(
  expr1: string,
  expr2: string,
  xMin: number,
  xMax: number,
  sliderValues: Record<string, number>,
  condition1?: string,
  condition2?: string
): IntersectionPoint[] {
  const processed1 = preprocessExpression(expr1);
  const processed2 = preprocessExpression(expr2);
  const cond1 = compileCondition(condition1);
  const cond2 = compileCondition(condition2);

  let compiled1: math.EvalFunction;
  let compiled2: math.EvalFunction;
  try {
    compiled1 = math.compile(processed1);
    compiled2 = math.compile(processed2);
  } catch {
    return [];
  }

  const evalDiff = (x: number): number | null => {
    const scope = { x, ...sliderValues };
    try {
      const y1 = compiled1.evaluate(scope);
      const y2 = compiled2.evaluate(scope);
      if (typeof y1 !== 'number' || typeof y2 !== 'number' || !isFinite(y1) || !isFinite(y2)) return null;
      if (!evaluateCondition(cond1, { ...scope, y: y1 })) return null;
      if (!evaluateCondition(cond2, { ...scope, y: y2 })) return null;
      return y1 - y2;
    } catch {
      return null;
    }
  };

  return bisectIntersections(evalDiff, xMin, xMax, (x: number) => {
    const scope = { x, ...sliderValues };
    try {
      return compiled1.evaluate(scope);
    } catch { return NaN; }
  });
}

/**
 * Find intersection points between a piecewise equation and another equation (explicit or piecewise).
 */
export function findPiecewiseIntersections(
  eq1: Equation,
  eq2: Equation,
  xMin: number,
  xMax: number,
  sliderValues: Record<string, number>
): IntersectionPoint[] {
  const evalAt1 = makeEvaluatorForEquation(eq1, sliderValues);
  const evalAt2 = makeEvaluatorForEquation(eq2, sliderValues);
  if (!evalAt1 || !evalAt2) return [];

  const evalDiff = (x: number): number | null => {
    const y1 = evalAt1(x);
    const y2 = evalAt2(x);
    if (y1 === null || y2 === null) return null;
    return y1 - y2;
  };

  return bisectIntersections(evalDiff, xMin, xMax, (x: number) => evalAt1(x) ?? NaN);
}

/**
 * Find intersection points between two parametric/polar curves using proximity detection.
 */
export function findCurveIntersections(
  points1: Point2D[],
  points2: Point2D[]
): IntersectionPoint[] {
  const results: IntersectionPoint[] = [];
  const threshold = 0.05; // proximity threshold in world units

  // Build a spatial grid for points2 for efficiency
  const validPts2 = points2.filter(p => isFinite(p.x) && isFinite(p.y));
  if (validPts2.length === 0) return [];

  for (let i = 1; i < points1.length; i++) {
    const a1 = points1[i - 1];
    const a2 = points1[i];
    if (!isFinite(a1.x) || !isFinite(a1.y) || !isFinite(a2.x) || !isFinite(a2.y)) continue;

    for (let j = 1; j < validPts2.length; j++) {
      const b1 = validPts2[j - 1];
      const b2 = validPts2[j];

      // Check if segments intersect using line segment intersection
      const inter = segmentIntersection(a1, a2, b1, b2);
      if (inter) {
        const isDuplicate = results.some(r =>
          Math.abs(r.x - inter.x) < threshold && Math.abs(r.y - inter.y) < threshold
        );
        if (!isDuplicate) {
          results.push({ x: parseFloat(inter.x.toFixed(6)), y: parseFloat(inter.y.toFixed(6)) });
        }
      }
    }
  }

  return results;
}

/** Create a y=f(x) evaluator for explicit, inequality, or piecewise equations */
function makeEvaluatorForEquation(
  eq: Equation,
  sliderValues: Record<string, number>
): ((x: number) => number | null) | null {
  if (eq.type === 'piecewise' && eq.pieces && eq.pieces.length > 0) {
    const compiled = eq.pieces.map(p => {
      try {
        return {
          expr: math.compile(preprocessExpression(p.expression)),
          cond: compileCondition(p.condition),
        };
      } catch { return null; }
    });
    return (x: number) => {
      const scope = { x, ...sliderValues };
      for (const c of compiled) {
        if (!c) continue;
        if (evaluateCondition(c.cond, scope)) {
          try {
            const y = c.expr.evaluate(scope);
            if (typeof y === 'number' && isFinite(y)) return y;
          } catch { /* skip */ }
        }
      }
      return null;
    };
  }

  if (eq.type === 'explicit' || eq.type === 'inequality') {
    const cond = compileCondition(eq.condition);
    try {
      const compiled = math.compile(preprocessExpression(eq.expression));
      return (x: number) => {
        const scope = { x, ...sliderValues };
        try {
          const y = compiled.evaluate(scope);
          if (typeof y !== 'number' || !isFinite(y)) return null;
          if (!evaluateCondition(cond, { ...scope, y })) return null;
          return y;
        } catch { return null; }
      };
    } catch { return null; }
  }

  return null;
}

/** Generic bisection-based intersection finder */
function bisectIntersections(
  evalDiff: (x: number) => number | null,
  xMin: number,
  xMax: number,
  evalY: (x: number) => number
): IntersectionPoint[] {
  const results: IntersectionPoint[] = [];
  const resolution = 2000;
  const step = (xMax - xMin) / resolution;
  let prevDiff = evalDiff(xMin);

  for (let i = 1; i <= resolution; i++) {
    const x = xMin + i * step;
    const diff = evalDiff(x);
    if (diff === null || prevDiff === null) {
      prevDiff = diff;
      continue;
    }

    if (prevDiff * diff <= 0) {
      let lo = x - step;
      let hi = x;
      let loDiff = prevDiff;
      for (let j = 0; j < 50; j++) {
        const mid = (lo + hi) / 2;
        const midDiff = evalDiff(mid);
        if (midDiff === null) break;
        if (Math.abs(midDiff) < 1e-12) { lo = hi = mid; break; }
        if (loDiff * midDiff <= 0) {
          hi = mid;
        } else {
          lo = mid;
          loDiff = midDiff;
        }
      }
      const ix = (lo + hi) / 2;
      const iy = evalY(ix);
      if (typeof iy === 'number' && isFinite(iy)) {
        const isDuplicate = results.some(r => Math.abs(r.x - ix) < step * 0.5);
        if (!isDuplicate) {
          results.push({ x: parseFloat(ix.toFixed(8)), y: parseFloat(iy.toFixed(8)) });
        }
      }
    }
    prevDiff = diff;
  }

  return results;
}

/** Line segment intersection test */
function segmentIntersection(
  a1: Point2D, a2: Point2D,
  b1: Point2D, b2: Point2D
): Point2D | null {
  const dx1 = a2.x - a1.x, dy1 = a2.y - a1.y;
  const dx2 = b2.x - b1.x, dy2 = b2.y - b1.y;
  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < 1e-12) return null; // parallel

  const t = ((b1.x - a1.x) * dy2 - (b1.y - a1.y) * dx2) / denom;
  const u = ((b1.x - a1.x) * dy1 - (b1.y - a1.y) * dx1) / denom;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return { x: a1.x + t * dx1, y: a1.y + t * dy1 };
  }
  return null;
}

// Parse condition string like "x > 1", "x >= 0 and x < 5", "x != 0"
function compileCondition(condition: string | undefined): math.EvalFunction | null {
  if (!condition || !condition.trim()) return null;
  try {
    // Convert user-friendly syntax to mathjs boolean expressions
    let cond = condition.trim();
    // Support "and" / "or" keywords
    cond = cond.replace(/\band\b/gi, ' and ');
    cond = cond.replace(/\bor\b/gi, ' or ');
    // Preprocess like normal expressions (implicit multiplication etc.)
    cond = cond.replace(/π/g, 'pi');
    cond = cond.replace(/θ/g, 'theta');
    return math.compile(cond);
  } catch {
    return null;
  }
}

function evaluateCondition(
  compiledCond: math.EvalFunction | null,
  scope: Record<string, number>
): boolean {
  if (!compiledCond) return true; // no condition = always show
  try {
    const result = compiledCond.evaluate(scope);
    return result === true || result === 1;
  } catch {
    return false;
  }
}

export interface BoundaryPoint {
  x: number;
  y: number;
  inclusive: boolean; // true = filled dot, false = hollow circle
}

// Parse condition to extract boundary x-values and their inclusion/exclusion
export function extractBoundaryPoints(
  condition: string | undefined,
  expr: string,
  sliderValues: Record<string, number>
): BoundaryPoint[] {
  if (!condition || !condition.trim()) return [];

  const boundaries: BoundaryPoint[] = [];
  const processed = preprocessExpression(expr);

  let compiledExpr: math.EvalFunction;
  try {
    compiledExpr = math.compile(processed);
  } catch {
    return [];
  }

  // Split by 'and' / 'or' to get individual clauses
  const clauses = condition.split(/\b(?:and|or)\b/gi).map(c => c.trim()).filter(Boolean);

  for (const clause of clauses) {
    // Match patterns like: x >= 1, x > 0, x = 3, x <= -2, x < 5, 1 < x, etc.
    let match: RegExpMatchArray | null;
    let boundaryX: number | null = null;
    let inclusive = false;

    // Pattern: x >= val, x > val, x <= val, x < val, x = val, x == val
    match = clause.match(/^\s*x\s*(>=|<=|!=|>|<|={1,2})\s*(.+)$/i);
    if (match) {
      const op = match[1];
      try {
        boundaryX = math.evaluate(match[2].trim(), sliderValues);
      } catch { continue; }
      inclusive = op === '>=' || op === '<=' || op === '=' || op === '==';
    }

    // Pattern: val >= x, val > x, val <= x, val < x
    if (boundaryX === null) {
      match = clause.match(/^(.+?)\s*(>=|<=|!=|>|<|={1,2})\s*x\s*$/i);
      if (match) {
        const op = match[2];
        try {
          boundaryX = math.evaluate(match[1].trim(), sliderValues);
        } catch { continue; }
        inclusive = op === '>=' || op === '<=' || op === '=' || op === '==';
      }
    }

    if (boundaryX !== null && typeof boundaryX === 'number' && isFinite(boundaryX)) {
      try {
        const y = compiledExpr.evaluate({ x: boundaryX, ...sliderValues });
        if (typeof y === 'number' && isFinite(y)) {
          boundaries.push({ x: boundaryX, y, inclusive });
        }
      } catch { /* skip */ }
    }
  }

  return boundaries;
}

export function evaluate2DPoints(
  expr: string,
  xMin: number,
  xMax: number,
  sliderValues: Record<string, number>,
  resolution: number = 1000,
  condition?: string
): Point2D[] {
  const points: Point2D[] = [];
  const step = (xMax - xMin) / resolution;
  const processed = preprocessExpression(expr);
  const compiledCond = compileCondition(condition);

  let compiledExpr: math.EvalFunction;
  try {
    compiledExpr = math.compile(processed);
  } catch {
    return points;
  }

  for (let i = 0; i <= resolution; i++) {
    const x = xMin + i * step;
    try {
      const scope = { x, ...sliderValues };
      const y = compiledExpr.evaluate(scope);
      if (typeof y === 'number' && isFinite(y) && evaluateCondition(compiledCond, { ...scope, y })) {
        points.push({ x, y });
      } else {
        points.push({ x, y: NaN });
      }
    } catch {
      points.push({ x, y: NaN });
    }
  }

  return points;
}

// Piecewise evaluation: multiple expressions with conditions
export function evaluatePiecewisePoints(
  pieces: PiecewisePiece[],
  xMin: number,
  xMax: number,
  sliderValues: Record<string, number>,
  resolution: number = 1000
): { points: Point2D[]; pieceIndex: number[] } {
  const points: Point2D[] = [];
  const pieceIndex: number[] = [];
  const step = (xMax - xMin) / resolution;

  const compiled = pieces.map(p => {
    try {
      return {
        expr: math.compile(preprocessExpression(p.expression)),
        cond: compileCondition(p.condition),
      };
    } catch {
      return null;
    }
  });

  for (let i = 0; i <= resolution; i++) {
    const x = xMin + i * step;
    let matched = false;
    for (let pi = 0; pi < compiled.length; pi++) {
      const c = compiled[pi];
      if (!c) continue;
      const scope = { x, ...sliderValues };
      if (evaluateCondition(c.cond, scope)) {
        try {
          const y = c.expr.evaluate(scope);
          if (typeof y === 'number' && isFinite(y)) {
            points.push({ x, y });
            pieceIndex.push(pi);
            matched = true;
            break;
          }
        } catch { /* skip */ }
      }
    }
    if (!matched) {
      points.push({ x, y: NaN });
      pieceIndex.push(-1);
    }
  }

  return { points, pieceIndex };
}

export function extractPiecewiseBoundaryPoints(
  pieces: PiecewisePiece[],
  sliderValues: Record<string, number>
): BoundaryPoint[] {
  const allBoundaries: BoundaryPoint[] = [];
  for (const piece of pieces) {
    const boundaries = extractBoundaryPoints(piece.condition, piece.expression, sliderValues);
    allBoundaries.push(...boundaries);
  }
  return allBoundaries;
}

// Parametric evaluation: x(t) and y(t) over t range
export function evaluateParametricPoints(
  exprX: string,
  exprY: string,
  tMin: number,
  tMax: number,
  sliderValues: Record<string, number>,
  resolution: number = 1000
): Point2D[] {
  const points: Point2D[] = [];
  const step = (tMax - tMin) / resolution;
  const processedX = preprocessExpression(exprX);
  const processedY = preprocessExpression(exprY);

  let compiledX: math.EvalFunction;
  let compiledY: math.EvalFunction;
  try {
    compiledX = math.compile(processedX);
    compiledY = math.compile(processedY);
  } catch {
    return points;
  }

  for (let i = 0; i <= resolution; i++) {
    const t = tMin + i * step;
    try {
      const scope = { t, ...sliderValues };
      const x = compiledX.evaluate(scope);
      const y = compiledY.evaluate(scope);
      if (typeof x === 'number' && isFinite(x) && typeof y === 'number' && isFinite(y)) {
        points.push({ x, y });
      } else {
        points.push({ x: NaN, y: NaN });
      }
    } catch {
      points.push({ x: NaN, y: NaN });
    }
  }

  return points;
}

// Polar evaluation: r(theta) -> (x, y)
export function evaluatePolarPoints(
  expr: string,
  thetaMin: number,
  thetaMax: number,
  sliderValues: Record<string, number>,
  resolution: number = 1000
): Point2D[] {
  const points: Point2D[] = [];
  const step = (thetaMax - thetaMin) / resolution;
  const processed = preprocessExpression(expr);

  let compiled: math.EvalFunction;
  try {
    compiled = math.compile(processed);
  } catch {
    return points;
  }

  for (let i = 0; i <= resolution; i++) {
    const theta = thetaMin + i * step;
    try {
      const scope = { theta, t: theta, ...sliderValues };
      const r = compiled.evaluate(scope);
      if (typeof r === 'number' && isFinite(r)) {
        points.push({ x: r * Math.cos(theta), y: r * Math.sin(theta) });
      } else {
        points.push({ x: NaN, y: NaN });
      }
    } catch {
      points.push({ x: NaN, y: NaN });
    }
  }

  return points;
}

export function evaluate3DSurface(
  expr: string,
  xRange: [number, number],
  yRange: [number, number],
  sliderValues: Record<string, number>,
  resolution: number = 60
): { positions: Float32Array; colors: Float32Array; indices: Uint32Array } {
  const processed = preprocessExpression(expr);
  let compiledExpr: math.EvalFunction;
  try {
    compiledExpr = math.compile(processed);
  } catch {
    return { positions: new Float32Array(0), colors: new Float32Array(0), indices: new Uint32Array(0) };
  }

  const xStep = (xRange[1] - xRange[0]) / resolution;
  const yStep = (yRange[1] - yRange[0]) / resolution;
  const vertCount = (resolution + 1) * (resolution + 1);

  const positions = new Float32Array(vertCount * 3);
  const colors = new Float32Array(vertCount * 3);
  const indices: number[] = [];

  let minZ = Infinity, maxZ = -Infinity;
  const zValues: number[] = [];

  for (let i = 0; i <= resolution; i++) {
    for (let j = 0; j <= resolution; j++) {
      const x = xRange[0] + i * xStep;
      const y = yRange[0] + j * yStep;
      let z = 0;
      try {
        z = compiledExpr.evaluate({ x, y, ...sliderValues });
        if (typeof z !== 'number' || !isFinite(z)) z = 0;
      } catch {
        z = 0;
      }
      zValues.push(z);
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
  }

  const zRange = maxZ - minZ || 1;

  for (let i = 0; i <= resolution; i++) {
    for (let j = 0; j <= resolution; j++) {
      const idx = i * (resolution + 1) + j;
      const x = xRange[0] + i * xStep;
      const y = yRange[0] + j * yStep;
      const z = zValues[idx];

      positions[idx * 3] = x;
      positions[idx * 3 + 1] = z;
      positions[idx * 3 + 2] = y;

      // Color based on height
      const t = (z - minZ) / zRange;
      // Gradient: blue -> cyan -> green -> yellow -> red
      const hue = (1 - t) * 240;
      const [r, g, b] = hslToRgb(hue / 360, 0.8, 0.55);
      colors[idx * 3] = r;
      colors[idx * 3 + 1] = g;
      colors[idx * 3 + 2] = b;
    }
  }

  for (let i = 0; i < resolution; i++) {
    for (let j = 0; j < resolution; j++) {
      const a = i * (resolution + 1) + j;
      const b = a + 1;
      const c = (i + 1) * (resolution + 1) + j;
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  return { positions, colors, indices: new Uint32Array(indices) };
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return [f(0), f(8), f(4)];
}

export function detectSliders(expr: string): SliderDef[] {
  const processed = preprocessExpression(expr);
  const reserved = new Set(['x', 'y', 'z', 't', 'theta', 'r', 'e', 'pi', 'i',
    'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'sqrt', 'abs', 'log',
    'ln', 'exp', 'ceil', 'floor', 'round', 'max', 'min', 'pow', 'mod',
    'sec', 'csc', 'cot', 'sinh', 'cosh', 'tanh', 'sign']);

  const vars = new Set<string>();
  const matches = processed.match(/[a-zA-Z_][a-zA-Z0-9_]*/g);
  if (matches) {
    for (const m of matches) {
      if (!reserved.has(m.toLowerCase())) {
        vars.add(m);
      }
    }
  }

  return Array.from(vars).map(name => ({
    name,
    min: -10,
    max: 10,
    value: 1,
    step: 0.1,
  }));
}

export function solveExpression(input: string): SolveResult {
  const trimmed = input.trim().toLowerCase();

  try {
    // Derivative
    if (trimmed.startsWith('derivative') || trimmed.startsWith('d/dx') || trimmed.includes('derivative')) {
      const exprMatch = input.match(/(?:derivative\s+(?:of\s+)?|d\/dx\s*\(?)(.*?)(?:\)|$)/i);
      const expr = exprMatch ? exprMatch[1].trim() : input.replace(/derivative|d\/dx/gi, '').trim();
      const processed = preprocessExpression(expr);
      const derivative = math.derivative(processed, 'x');
      return {
        type: 'derivative',
        input,
        result: derivative.toString(),
        steps: [
          `Given: f(x) = ${expr}`,
          `Applying differentiation rules`,
          `f'(x) = ${derivative.toString()}`
        ]
      };
    }

    // Integral (basic)
    if (trimmed.includes('integral') || trimmed.includes('∫') || trimmed.includes('integrate')) {
      const exprMatch = input.match(/(?:integral\s+(?:of\s+)?|∫\s*|integrate\s+)(.*?)(?:\s+dx|$)/i);
      const expr = exprMatch ? exprMatch[1].trim() : input.replace(/integral|∫|integrate|dx/gi, '').trim();
      const processed = preprocessExpression(expr);
      // math.js doesn't have symbolic integration, but we can try basic power rule
      const result = basicIntegrate(processed);
      return {
        type: 'integral',
        input,
        result: result + ' + C',
        steps: [
          `Given: ∫ ${expr} dx`,
          `Applying integration rules`,
          `Result: ${result} + C`
        ]
      };
    }

    // Simplify
    if (trimmed.startsWith('simplify')) {
      const expr = input.replace(/simplify/i, '').trim();
      const processed = preprocessExpression(expr);
      const simplified = math.simplify(processed);
      return {
        type: 'simplify',
        input,
        result: simplified.toString(),
        steps: [
          `Given: ${expr}`,
          `Simplified: ${simplified.toString()}`
        ]
      };
    }

    // Solve equation
    if (trimmed.startsWith('solve')) {
      const expr = input.replace(/solve/i, '').trim();
      // Try to find roots numerically
      const roots = findRoots(expr);
      return {
        type: 'roots',
        input,
        result: roots.length > 0 ? roots.map(r => `x = ${r}`).join(', ') : 'No real roots found',
        steps: [
          `Given: ${expr}`,
          `Finding roots...`,
          ...roots.map(r => `x = ${r}`)
        ]
      };
    }

    // Default: try to evaluate
    const result = math.evaluate(preprocessExpression(input));
    return {
      type: 'simplify',
      input,
      result: String(result),
    };
  } catch (e) {
    return {
      type: 'error',
      input,
      result: `Could not process: ${e instanceof Error ? e.message : 'unknown error'}`,
    };
  }
}

function basicIntegrate(expr: string): string {
  try {
    // Use math.js simplify to handle basic cases
    const node = math.parse(expr);
    // For polynomial terms, apply power rule
    const simplified = math.simplify(node);
    const str = simplified.toString();

    // Simple power rule: x^n -> x^(n+1)/(n+1)
    if (/^x(\^(\d+))?$/.test(str)) {
      const powerMatch = str.match(/\^(\d+)/);
      const n = powerMatch ? parseInt(powerMatch[1]) : 1;
      return `(x^${n + 1})/${n + 1}`;
    }

    // Try term-by-term for sums
    return `∫(${str})dx`;
  } catch {
    return `∫(${expr})dx`;
  }
}

function findRoots(expr: string): number[] {
  let processed = expr;
  if (processed.includes('=')) {
    const parts = processed.split('=');
    processed = `(${parts[0]}) - (${parts[1]})`;
  }
  processed = preprocessExpression(processed);

  let compiled: math.EvalFunction;
  try {
    compiled = math.compile(processed);
  } catch {
    return [];
  }

  const roots: number[] = [];
  const step = 0.01;

  for (let x = -20; x < 20; x += step) {
    try {
      const y1 = compiled.evaluate({ x });
      const y2 = compiled.evaluate({ x: x + step });
      if (typeof y1 === 'number' && typeof y2 === 'number' && isFinite(y1) && isFinite(y2)) {
        if (y1 * y2 <= 0) {
          // Bisection refinement
          let lo = x, hi = x + step;
          for (let i = 0; i < 50; i++) {
            const mid = (lo + hi) / 2;
            const yMid = compiled.evaluate({ x: mid });
            if (typeof yMid !== 'number' || !isFinite(yMid)) break;
            if (Math.abs(yMid) < 1e-12) { lo = hi = mid; break; }
            if (yMid * compiled.evaluate({ x: lo }) < 0) hi = mid;
            else lo = mid;
          }
          const root = Math.round((lo + hi) / 2 * 1e6) / 1e6;
          if (!roots.some(r => Math.abs(r - root) < 0.001)) {
            roots.push(root);
          }
        }
      }
    } catch {
      continue;
    }
  }

  return roots;
}

export function parseInequalityExpression(input: string): { expression: string; inequality: InequalityType } {
  // Match patterns like "y >= x^2", "y < sin(x)", etc.
  const match = input.match(/^\s*y\s*(>=|<=|>|<)\s*(.+)$/i);
  if (match) {
    return { expression: match[2].trim(), inequality: match[1] as InequalityType };
  }
  return { expression: input, inequality: null };
}

export function createDefaultEquation(expression: string = ''): Equation {
  return {
    id: crypto.randomUUID(),
    expression,
    color: getNextColor(),
    visible: true,
    type: 'explicit',
    condition: '',
    inequality: null,
    sliders: [],
  };
}
