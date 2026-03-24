import React, { useState } from 'react';
import { solveExpression, SolveResult } from '@/lib/mathEngine';
import { Send, ChevronRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SolverPanelProps {
  onClose: () => void;
}

const EXAMPLES = [
  'solve x^2 - 4 = 0',
  'derivative of x^3 + 2x',
  'integral of x^2 dx',
  'simplify (x^2 - 1)/(x - 1)',
];

const SolverPanel: React.FC<SolverPanelProps> = ({ onClose }) => {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<SolveResult[]>([]);

  const handleSolve = () => {
    if (!input.trim()) return;
    const result = solveExpression(input);
    setResults(prev => [result, ...prev]);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSolve();
  };

  return (
    <div className="w-80 h-full flex flex-col bg-card border-l border-border overflow-hidden">
      <div className="panel-section flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Math Solver</h2>
        <button className="toolbar-btn p-1" onClick={onClose}>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Input */}
      <div className="p-3 border-b border-border">
        <div className="flex gap-2">
          <input
            type="text"
            className="equation-input flex-1"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. solve x^2 - 4 = 0"
            spellCheck={false}
          />
          <button
            onClick={handleSolve}
            className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium
              hover:bg-primary/90 active:scale-95 transition-all"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Quick examples */}
        <div className="mt-2 flex flex-wrap gap-1">
          {EXAMPLES.map(ex => (
            <button
              key={ex}
              className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground
                hover:text-foreground hover:bg-secondary/80 transition-colors"
              onClick={() => {
                setInput(ex);
              }}
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence>
          {results.map((r, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 border-b border-border"
            >
              <div className="text-xs text-muted-foreground mb-1 font-mono">{r.input}</div>
              <div className={`text-sm font-mono font-semibold ${
                r.type === 'error' ? 'text-destructive' : 'text-primary'
              }`}>
                {r.result}
              </div>
              {r.steps && r.steps.length > 0 && (
                <div className="mt-2 space-y-1">
                  {r.steps.map((step, si) => (
                    <div key={si} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                      <ChevronRight className="w-3 h-3 mt-0.5 shrink-0 text-primary/50" />
                      <span className="font-mono">{step}</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {results.length === 0 && (
          <div className="p-6 text-center text-muted-foreground text-xs">
            <p className="mb-2">Try solving equations, computing derivatives, or simplifying expressions.</p>
            <p className="font-mono text-[10px] opacity-60">
              solve • derivative • integral • simplify
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SolverPanel;
