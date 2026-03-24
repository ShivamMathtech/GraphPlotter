import React from 'react';
import { BarChart3, Box, Calculator, Download, Play, Pause, RotateCcw } from 'lucide-react';

interface ToolbarProps {
  mode: '2d' | '3d';
  onModeChange: (mode: '2d' | '3d') => void;
  showSolver: boolean;
  onToggleSolver: () => void;
  animating: boolean;
  onToggleAnimate: () => void;
  onExport: () => void;
  onReset: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  mode,
  onModeChange,
  showSolver,
  onToggleSolver,
  animating,
  onToggleAnimate,
  onExport,
  onReset,
}) => {
  return (
    <div className="h-12 bg-card border-b border-border flex items-center px-3 gap-1">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-4">
        <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
          <BarChart3 className="w-4 h-4 text-primary" />
        </div>
        <span className="text-sm font-semibold text-foreground tracking-tight hidden sm:inline">
          MathGraph
        </span>
      </div>

      <div className="h-5 w-px bg-border mx-1" />

      {/* Mode toggle */}
      <div className="flex items-center bg-secondary/50 rounded-md p-0.5">
        <button
          className={`toolbar-btn ${mode === '2d' ? 'toolbar-btn-active' : ''}`}
          onClick={() => onModeChange('2d')}
        >
          <BarChart3 className="w-3.5 h-3.5 inline mr-1" />
          2D
        </button>
        <button
          className={`toolbar-btn ${mode === '3d' ? 'toolbar-btn-active' : ''}`}
          onClick={() => onModeChange('3d')}
        >
          <Box className="w-3.5 h-3.5 inline mr-1" />
          3D
        </button>
      </div>

      <div className="h-5 w-px bg-border mx-1" />

      {/* Tools */}
      <button
        className={`toolbar-btn ${showSolver ? 'toolbar-btn-active' : ''}`}
        onClick={onToggleSolver}
        title="Math Solver"
      >
        <Calculator className="w-3.5 h-3.5 inline mr-1" />
        <span className="hidden sm:inline">Solver</span>
      </button>

      <button
        className={`toolbar-btn ${animating ? 'toolbar-btn-active' : ''}`}
        onClick={onToggleAnimate}
        title="Animate"
      >
        {animating ? (
          <Pause className="w-3.5 h-3.5 inline mr-1" />
        ) : (
          <Play className="w-3.5 h-3.5 inline mr-1" />
        )}
        <span className="hidden sm:inline">Animate</span>
      </button>

      <div className="flex-1" />

      <button className="toolbar-btn" onClick={onReset} title="Reset View">
        <RotateCcw className="w-3.5 h-3.5" />
      </button>

      <button className="toolbar-btn" onClick={onExport} title="Export">
        <Download className="w-3.5 h-3.5 inline mr-1" />
        <span className="hidden sm:inline">Export</span>
      </button>
    </div>
  );
};

export default Toolbar;
