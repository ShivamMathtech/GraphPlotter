import React, { useCallback } from 'react';
import { Equation, SliderDef, detectSliders, createDefaultEquation, InequalityType, PiecewisePiece } from '@/lib/mathEngine';
import { Plus, Eye, EyeOff, GripVertical, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface EquationPanelProps {
  equations: Equation[];
  sliderValues: Record<string, number>;
  onEquationsChange: (equations: Equation[]) => void;
  onSliderChange: (name: string, value: number) => void;
  mode: '2d' | '3d';
}

const TYPE_OPTIONS: { value: Equation['type']; label: string }[] = [
  { value: 'explicit', label: 'y = f(x)' },
  { value: 'inequality', label: 'Inequality' },
  { value: 'piecewise', label: 'Piecewise' },
  { value: 'parametric', label: 'Parametric' },
  { value: 'polar', label: 'Polar' },
];

const INEQUALITY_OPTIONS: { value: InequalityType; label: string }[] = [
  { value: '>', label: 'y >' },
  { value: '<', label: 'y <' },
  { value: '>=', label: 'y ≥' },
  { value: '<=', label: 'y ≤' },
];

const EquationPanel: React.FC<EquationPanelProps> = ({
  equations,
  sliderValues,
  onEquationsChange,
  onSliderChange,
  mode,
}) => {
  const updateEquation = useCallback(
    (id: string, updates: Partial<Equation>) => {
      onEquationsChange(
        equations.map((eq) => {
          if (eq.id !== id) return eq;
          const updated = { ...eq, ...updates };
          let allExprs = [updated.expression, updated.parametricY || '', updated.condition || ''].join(' ');
          if (updated.pieces) {
            allExprs += ' ' + updated.pieces.map(p => `${p.expression} ${p.condition}`).join(' ');
          }
          updated.sliders = detectSliders(allExprs);
          return updated;
        })
      );
    },
    [equations, onEquationsChange]
  );

  const addEquation = useCallback(() => {
    const newEq = createDefaultEquation('');
    onEquationsChange([...equations, newEq]);
  }, [equations, onEquationsChange]);

  const removeEquation = useCallback(
    (id: string) => {
      onEquationsChange(equations.filter((eq) => eq.id !== id));
    },
    [equations, onEquationsChange]
  );

  // Collect all sliders from all equations
  const allSliders = new Map<string, SliderDef>();
  for (const eq of equations) {
    for (const s of eq.sliders) {
      if (!allSliders.has(s.name)) {
        allSliders.set(s.name, s);
      }
    }
  }

  const getPlaceholder = (eq: Equation, field: 'x' | 'y' | 'main') => {
    if (eq.type === 'parametric') {
      return field === 'x' ? 'e.g. cos(t)' : 'e.g. sin(t)';
    }
    if (eq.type === 'polar') return 'e.g. 2*sin(theta)';
    if (eq.type === 'inequality') return 'e.g. x^2';
    return mode === '2d' ? 'e.g. sin(x)' : 'e.g. x^2 + y^2';
  };

  const getLabel = (eq: Equation, index: number) => {
    if (eq.type === 'parametric') return `p${index + 1}`;
    if (eq.type === 'polar') return `r${index + 1}`;
    if (eq.type === 'inequality') return `ineq${index + 1}`;
    if (eq.type === 'piecewise') return `pw${index + 1}`;
    return mode === '2d' ? `y${index + 1}` : `z${index + 1}`;
  };

  return (
    <div className="w-full h-full flex flex-col bg-card border-r border-border overflow-hidden">
      {/* Header */}
      <div className="panel-section flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          Equations{' '}
          {mode === '3d' && <span className="text-muted-foreground font-normal">(z = f(x,y))</span>}
        </h2>
        <button onClick={addEquation} className="toolbar-btn flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>

      {/* Equations List */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence initial={false}>
          {equations.map((eq, index) => (
            <motion.div
              key={eq.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="border-b border-border"
            >
              <div className="p-3 flex items-start gap-2">
                <div className="flex flex-col items-center gap-1 pt-2">
                  <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40" />
                  <div className="color-dot mt-0.5" style={{ backgroundColor: eq.color }} />
                </div>

                <div className="flex-1 min-w-0">
                  {/* Type selector (2D only) */}
                  {mode === '2d' && (
                    <div className="flex gap-1 mb-1.5 flex-wrap">
                      {TYPE_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          className={`px-2 py-0.5 text-[10px] rounded font-medium transition-colors ${
                            eq.type === opt.value
                              ? 'bg-primary/15 text-primary'
                              : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                          }`}
                          onClick={() =>
                            updateEquation(eq.id, {
                              type: opt.value,
                              expression: '',
                              parametricY: '',
                              inequality: opt.value === 'inequality' ? '>' : null,
                              pieces: opt.value === 'piecewise' ? [
                                { expression: '', condition: '' },
                                { expression: '', condition: '' },
                              ] : undefined,
                            })
                          }
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Inequality operator selector */}
                  {eq.type === 'inequality' && (
                    <div className="flex gap-1 mb-1.5">
                      {INEQUALITY_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          className={`px-2 py-0.5 text-[10px] rounded font-mono font-semibold transition-colors ${
                            eq.inequality === opt.value
                              ? 'bg-accent text-accent-foreground'
                              : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                          }`}
                          onClick={() => updateEquation(eq.id, { inequality: opt.value })}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Label */}
                  {eq.type !== 'piecewise' && (
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {eq.type === 'parametric'
                          ? 'x(t)'
                          : eq.type === 'polar'
                          ? 'r(θ)'
                          : eq.type === 'inequality'
                          ? `y ${eq.inequality || '>'}`
                          : `${getLabel(eq, index)}`}{' '}
                        =
                      </span>
                    </div>
                  )}

                  {/* Main expression input (not for piecewise) */}
                  {eq.type !== 'piecewise' && (
                    <input
                      type="text"
                      className="equation-input w-full font-mono text-sm"
                      value={eq.expression}
                      onChange={(e) => updateEquation(eq.id, { expression: e.target.value })}
                      placeholder={getPlaceholder(eq, eq.type === 'parametric' ? 'x' : 'main')}
                      spellCheck={false}
                      autoComplete="off"
                    />
                  )}

                  {/* Second input for parametric y(t) */}
                  {eq.type === 'parametric' && (
                    <>
                      <div className="flex items-center gap-1 mt-2 mb-1">
                        <span className="text-[10px] text-muted-foreground font-mono">y(t) =</span>
                      </div>
                      <input
                        type="text"
                        className="equation-input w-full font-mono text-sm"
                        value={eq.parametricY || ''}
                        onChange={(e) => updateEquation(eq.id, { parametricY: e.target.value })}
                        placeholder={getPlaceholder(eq, 'y')}
                        spellCheck={false}
                        autoComplete="off"
                      />
                    </>
                  )}

                  {/* Piecewise function pieces */}
                  {eq.type === 'piecewise' && (
                    <div className="space-y-2">
                      {(eq.pieces || []).map((piece, pi) => (
                        <div key={pi} className="rounded border border-border/50 p-2 bg-secondary/30">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-muted-foreground font-mono">
                              piece {pi + 1}
                            </span>
                            {(eq.pieces || []).length > 1 && (
                              <button
                                className="text-[10px] text-destructive hover:text-destructive/80 transition-colors"
                                onClick={() => {
                                  const newPieces = [...(eq.pieces || [])];
                                  newPieces.splice(pi, 1);
                                  updateEquation(eq.id, { pieces: newPieces });
                                }}
                              >
                                remove
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            className="equation-input w-full font-mono text-sm mb-1.5"
                            value={piece.expression}
                            onChange={(e) => {
                              const newPieces = [...(eq.pieces || [])];
                              newPieces[pi] = { ...newPieces[pi], expression: e.target.value };
                              updateEquation(eq.id, { pieces: newPieces });
                            }}
                            placeholder="e.g. x^2"
                            spellCheck={false}
                            autoComplete="off"
                          />
                          <div className="flex items-center gap-1 mb-1">
                            <span className="text-[10px] text-muted-foreground font-mono">when</span>
                          </div>
                          <input
                            type="text"
                            className="equation-input w-full font-mono text-[11px] text-muted-foreground"
                            value={piece.condition}
                            onChange={(e) => {
                              const newPieces = [...(eq.pieces || [])];
                              newPieces[pi] = { ...newPieces[pi], condition: e.target.value };
                              updateEquation(eq.id, { pieces: newPieces });
                            }}
                            placeholder="e.g. x < 0"
                            spellCheck={false}
                            autoComplete="off"
                          />
                        </div>
                      ))}
                      <button
                        className="text-[10px] text-primary hover:text-primary/80 transition-colors font-medium flex items-center gap-1"
                        onClick={() => {
                          const newPieces = [...(eq.pieces || []), { expression: '', condition: '' }];
                          updateEquation(eq.id, { pieces: newPieces });
                        }}
                      >
                        <Plus className="w-3 h-3" /> Add piece
                      </button>
                      <p className="text-[9px] text-muted-foreground">
                        ● Filled dot = inclusive · ○ Hollow = exclusive
                      </p>
                    </div>
                  )}

                  {/* Condition / domain restriction for explicit & inequality */}
                  {mode === '2d' && (eq.type === 'explicit' || eq.type === 'inequality') && (
                    <>
                      <div className="flex items-center gap-1 mt-2 mb-1">
                        <span className="text-[10px] text-muted-foreground font-mono">domain</span>
                      </div>
                      <input
                        type="text"
                        className="equation-input w-full font-mono text-[11px] text-muted-foreground"
                        value={eq.condition || ''}
                        onChange={(e) => updateEquation(eq.id, { condition: e.target.value })}
                        placeholder="e.g. x > 1, x >= 0 and x < 5"
                        spellCheck={false}
                        autoComplete="off"
                      />
                    </>
                  )}

                  {/* Boundary note for inequalities */}
                  {eq.type === 'inequality' && (
                    <p className="text-[9px] text-muted-foreground mt-1.5">
                      {eq.inequality === '>=' || eq.inequality === '<='
                        ? '━ Solid boundary (included)'
                        : '╌ Dashed boundary (excluded)'}
                    </p>
                  )}

                  {/* Hint text */}
                  {eq.type === 'parametric' && (
                    <p className="text-[9px] text-muted-foreground mt-1">t ∈ [0, 2π]</p>
                  )}
                  {eq.type === 'polar' && (
                    <p className="text-[9px] text-muted-foreground mt-1">
                      θ ∈ [0, 2π] · Use "theta" for θ
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-0.5 pt-1.5">
                  <button
                    className="toolbar-btn p-1"
                    onClick={() => updateEquation(eq.id, { visible: !eq.visible })}
                    title={eq.visible ? 'Hide' : 'Show'}
                  >
                    {eq.visible ? (
                      <Eye className="w-3.5 h-3.5" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    className="toolbar-btn p-1 hover:text-destructive transition-colors"
                    onClick={() => removeEquation(eq.id)}
                    title="Delete equation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Sliders */}
      {allSliders.size > 0 && (
        <div className="border-t border-border">
          <div className="panel-section">
            <h3 className="text-xs font-semibold text-muted-foreground mb-2">Parameters</h3>
            <div className="space-y-3">
              {Array.from(allSliders.entries()).map(([name, slider]) => (
                <div key={name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-foreground">{name}</span>
                    <span className="text-xs font-mono text-muted-foreground">
                      {(sliderValues[name] ?? slider.value).toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={slider.min}
                    max={slider.max}
                    step={slider.step}
                    value={sliderValues[name] ?? slider.value}
                    onChange={(e) => onSliderChange(name, parseFloat(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none bg-muted cursor-pointer
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                      [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary
                      [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background
                      [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-grab
                      [&::-webkit-slider-thumb]:active:cursor-grabbing"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EquationPanel;
