import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createDefaultEquation, Equation, resetColorIndex } from '@/lib/mathEngine';
import Canvas2D from '@/components/graph/Canvas2D';
import Graph3D from '@/components/graph/Graph3D';
import EquationPanel from '@/components/graph/EquationPanel';
import Toolbar from '@/components/graph/Toolbar';
import SolverPanel from '@/components/graph/SolverPanel';

const Index: React.FC = () => {
  const [mode, setMode] = useState<'2d' | '3d'>('2d');
  const [showSolver, setShowSolver] = useState(false);
  const [animating, setAnimating] = useState(false);
  const animRef = useRef<number>(0);

  const [equations, setEquations] = useState<Equation[]>(() => {
    resetColorIndex();
    return [
      createDefaultEquation('sin(x)'),
      createDefaultEquation('x^2 / 4'),
    ];
  });

  const [sliderValues, setSliderValues] = useState<Record<string, number>>({});

  const handleSliderChange = useCallback((name: string, value: number) => {
    setSliderValues(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleModeChange = useCallback((newMode: '2d' | '3d') => {
    setMode(newMode);
    if (newMode === '3d') {
      resetColorIndex();
      setEquations([createDefaultEquation('sin(sqrt(x^2 + y^2))')]);
    } else {
      resetColorIndex();
      setEquations([
        createDefaultEquation('sin(x)'),
        createDefaultEquation('x^2 / 4'),
      ]);
    }
  }, []);

  const handleExport = useCallback(() => {
    if (mode === '2d') {
      const canvas = document.querySelector('.graph-canvas') as HTMLCanvasElement;
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = 'graph.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  }, [mode]);

  const handleReset = useCallback(() => {
    resetColorIndex();
    if (mode === '2d') {
      setEquations([createDefaultEquation('sin(x)')]);
    } else {
      setEquations([createDefaultEquation('sin(sqrt(x^2 + y^2))')]);
    }
    setSliderValues({});
    setAnimating(false);
  }, [mode]);

  // Animation loop
  useEffect(() => {
    if (!animating) {
      cancelAnimationFrame(animRef.current);
      return;
    }

    let t = 0;
    const tick = () => {
      t += 0.02;
      setSliderValues(prev => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          next[key] = Math.sin(t) * 5;
        }
        return next;
      });
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animRef.current);
  }, [animating]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
      <Toolbar
        mode={mode}
        onModeChange={handleModeChange}
        showSolver={showSolver}
        onToggleSolver={() => setShowSolver(s => !s)}
        animating={animating}
        onToggleAnimate={() => setAnimating(a => !a)}
        onExport={handleExport}
        onReset={handleReset}
      />

      <div className="flex-1 flex min-h-0">
        {/* Left panel */}
        <div className="w-[340px] shrink-0 hidden md:block">
          <EquationPanel
            equations={equations}
            sliderValues={sliderValues}
            onEquationsChange={setEquations}
            onSliderChange={handleSliderChange}
            mode={mode}
          />
        </div>

        {/* Graph area */}
        <div className="flex-1 min-w-0 relative">
          {mode === '2d' ? (
            <Canvas2D equations={equations} sliderValues={sliderValues} />
          ) : (
            <Graph3D equations={equations} sliderValues={sliderValues} />
          )}

          {/* Mobile equation input */}
          <div className="md:hidden absolute bottom-0 left-0 right-0 bg-card/95 backdrop-blur border-t border-border p-3">
            <input
              type="text"
              className="equation-input w-full font-mono text-sm"
              value={equations[0]?.expression || ''}
              onChange={e => {
                const updated = [...equations];
                if (updated[0]) {
                  updated[0] = { ...updated[0], expression: e.target.value };
                  setEquations(updated);
                }
              }}
              placeholder={mode === '2d' ? 'y = sin(x)' : 'z = x^2 + y^2'}
              spellCheck={false}
            />
          </div>
        </div>

        {/* Right panel - Solver */}
        {showSolver && (
          <SolverPanel onClose={() => setShowSolver(false)} />
        )}
      </div>
    </div>
  );
};

export default Index;
