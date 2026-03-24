import React, { useMemo, useRef, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { evaluate3DSurface, Equation } from '@/lib/mathEngine';

// Simple OrbitControls implementation without drei
const SimpleOrbitControls: React.FC = () => {
  const { camera, gl } = useThree();
  const isDown = useRef(false);
  const prev = useRef({ x: 0, y: 0 });
  const spherical = useRef({ theta: Math.PI / 4, phi: Math.PI / 4, radius: 13 });

  useEffect(() => {
    const dom = gl.domElement;

    const onPointerDown = (e: PointerEvent) => {
      isDown.current = true;
      prev.current = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = () => { isDown.current = false; };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDown.current) return;
      const dx = e.clientX - prev.current.x;
      const dy = e.clientY - prev.current.y;
      prev.current = { x: e.clientX, y: e.clientY };
      spherical.current.theta -= dx * 0.005;
      spherical.current.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.current.phi - dy * 0.005));
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      spherical.current.radius = Math.max(3, Math.min(30, spherical.current.radius + e.deltaY * 0.01));
    };

    dom.addEventListener('pointerdown', onPointerDown);
    dom.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('pointermove', onPointerMove);
    dom.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('wheel', onWheel);
    };
  }, [gl]);

  useFrame(() => {
    const { theta, phi, radius } = spherical.current;
    camera.position.set(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
    camera.lookAt(0, 0, 0);
  });

  return null;
};

// Simple grid
const SimpleGrid: React.FC = () => {
  const lines = useMemo(() => {
    const pts: number[] = [];
    for (let i = -10; i <= 10; i++) {
      pts.push(i, 0, -10, i, 0, 10);
      pts.push(-10, 0, i, 10, 0, i);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return geom;
  }, []);

  return (
    <lineSegments geometry={lines}>
      <lineBasicMaterial color="#1e293b" />
    </lineSegments>
  );
};

interface Graph3DProps {
  equations: Equation[];
  sliderValues: Record<string, number>;
}

const SurfaceMesh: React.FC<{ equation: Equation; sliderValues: Record<string, number> }> = ({
  equation,
  sliderValues,
}) => {
  const geometry = useMemo(() => {
    const { positions, colors, indices } = evaluate3DSurface(
      equation.expression,
      [-5, 5],
      [-5, 5],
      sliderValues,
      50
    );

    if (positions.length === 0) return null;

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geom.setIndex(new THREE.BufferAttribute(indices, 1));
    geom.computeVertexNormals();
    return geom;
  }, [equation.expression, sliderValues]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry}>
      <meshPhongMaterial
        vertexColors
        side={THREE.DoubleSide}
        shininess={30}
        transparent
        opacity={0.85}
      />
    </mesh>
  );
};

const AxisLabels: React.FC = () => {
  return (
    <group>
      <mesh position={[6, 0, 0]}>
        <boxGeometry args={[12, 0.02, 0.02]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
      <mesh position={[0, 6, 0]}>
        <boxGeometry args={[0.02, 12, 0.02]} />
        <meshBasicMaterial color="#22c55e" />
      </mesh>
      <mesh position={[0, 0, 6]}>
        <boxGeometry args={[0.02, 0.02, 12]} />
        <meshBasicMaterial color="#3b82f6" />
      </mesh>
    </group>
  );
};

const Graph3D: React.FC<Graph3DProps> = ({ equations, sliderValues }) => {
  const visibleEqs = equations.filter(eq => eq.visible && eq.expression.trim());

  return (
    <div className="w-full h-full" style={{ background: 'hsl(220, 22%, 8%)' }}>
      <Canvas
        camera={{ position: [8, 6, 8], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color('hsl(220, 22%, 8%)'));
        }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={0.8} />
        <directionalLight position={[-5, 5, -5]} intensity={0.3} />

        <SimpleOrbitControls />
        <SimpleGrid />
        <AxisLabels />

        {visibleEqs.map(eq => (
          <SurfaceMesh key={eq.id} equation={eq} sliderValues={sliderValues} />
        ))}
      </Canvas>
    </div>
  );
};

export default Graph3D;
