# Graph Plotter - Visualize & Solve Pro

A powerful, interactive graph plotting application built with React, TypeScript, and Three.js. Visualize mathematical functions in 2D and 3D, solve equations, and explore mathematical concepts with an intuitive interface.

## Features

- **2D Graphing**: Plot functions on a 2D canvas with interactive zooming and panning
- **3D Graphing**: Visualize functions in 3D space using Three.js
- **Equation Solver**: Solve mathematical equations with built-in solver tools
- **Equation Panel**: Input and manage multiple equations
- **Toolbar**: Access various graphing tools and options
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Dark/Light Mode**: Toggle between themes for comfortable viewing
- **Export Options**: Save graphs as images or data files

## Technologies Used

- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with shadcn/ui components
- **3D Graphics**: Three.js with @react-three/fiber
- **State Management**: React Query for data fetching
- **Testing**: Vitest for unit testing
- **Linting**: ESLint for code quality

## Installation

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn package manager

### Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/ShivamMathtech/GraphPlotter.git
   cd visualize-solve-pro-main
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start the development server**

   ```bash
   npm run dev
   ```

4. **Open your browser**

   Navigate to `http://localhost:5173` to view the application.

## Usage

1. **Launch the app** using the development server
2. **Input equations** in the Equation Panel
3. **Select graphing mode** (2D or 3D) from the toolbar
4. **Interact with graphs** using mouse controls (zoom, rotate, pan)
5. **Use the solver** to find roots, intersections, or other solutions
6. **Export results** as needed

### Keyboard Shortcuts

- `Ctrl+Z`: Undo last action
- `Ctrl+Y`: Redo action
- `Space`: Toggle play/pause for animations

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run build:dev` - Build in development mode
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run test` - Run tests once
- `npm run test:watch` - Run tests in watch mode

### Project Structure

```
src/
├── components/
│   ├── graph/
│   │   ├── Canvas2D.tsx      # 2D graphing component
│   │   ├── Graph3D.tsx       # 3D graphing component
│   │   ├── EquationPanel.tsx # Equation input panel
│   │   ├── SolverPanel.tsx   # Equation solver
│   │   └── Toolbar.tsx       # Graphing tools
│   └── ui/                   # shadcn/ui components
├── hooks/                    # Custom React hooks
├── lib/
│   ├── mathEngine.ts         # Mathematical computations
│   └── utils.ts              # Utility functions
├── pages/                    # Application pages
└── test/                     # Test files
```

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Write tests for new features
- Ensure code passes linting
- Update documentation as needed

## Testing

Run the test suite:

```bash
npm run test
```

For continuous testing during development:

```bash
npm run test:watch
```

## Deployment
