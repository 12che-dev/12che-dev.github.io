import React, { useRef, useEffect, useState, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import SpriteText from 'three-spritetext';
import { CATEGORIES } from '../config';

// Helper to parse hex color to RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 255, g: 255, b: 255 };
}

// Texture generator for sharp stars/nodes (perfect circles)
function createGlowTexture(r, g, b, a) {
  const canvas = document.createElement('canvas');
  const size = 128; 
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  const center = size / 2;
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  
  gradient.addColorStop(0, `rgba(${r},${g},${b},${a})`);
  gradient.addColorStop(0.15, `rgba(${r},${g},${b},${a})`);
  gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  return tex;
}


const GLOW_TEXTURES = {};
function getGlowTexture(hexColor) {
  if (!GLOW_TEXTURES[hexColor]) {
    const { r, g, b } = hexToRgb(hexColor);
    GLOW_TEXTURES[hexColor] = createGlowTexture(r, g, b, 1.0);
  }
  return GLOW_TEXTURES[hexColor];
}

// Procedural 3D Space Background using Three.js
function initSpaceBackground(scene) {
  const bgGroup = new THREE.Group();
  
  // 1. Organic Starfield (Points)
  const starCount = 3000;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  
  for(let i=0; i < starCount; i++) {
    // Spread stars in a huge sphere
    const r = 800 + Math.random() * 1200;
    const theta = 2 * Math.PI * Math.random();
    const phi = Math.acos(2 * Math.random() - 1);
    
    starPos[i*3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
    starPos[i*3+2] = r * Math.cos(phi);

    // Subtle color variations (white, light blue, warm gold)
    const colorType = Math.random();
    const color = new THREE.Color();
    if (colorType > 0.85) color.setHex(0xaaccff);      // Blueish
    else if (colorType > 0.7) color.setHex(0xffddaa); // Warm/Gold
    else color.setHex(0xffffff);                      // White
    
    starColors[i*3] = color.r;
    starColors[i*3+1] = color.g;
    starColors[i*3+2] = color.b;
  }
  
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
  
  // Custom circular star texture for Points
  const canvas = document.createElement('canvas');
  canvas.width = 16; canvas.height = 16;
  const ctx = canvas.getContext('2d');
  ctx.beginPath();
  ctx.arc(8, 8, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  const starTex = new THREE.CanvasTexture(canvas);

  const starMat = new THREE.PointsMaterial({
    size: 5,
    map: starTex,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    sizeAttenuation: true,
    depthWrite: false
  });
  
  const stars = new THREE.Points(starGeo, starMat);
  bgGroup.add(stars);

  // 2. Volumetric Nebula Gas Clouds (GPU ShaderMaterial)
  // Radius is small enough to not hit far-plane, but depthTest: false makes it render infinitely far away.
  const nebulaGeo = new THREE.SphereGeometry(1000, 32, 32);
  const shaderMat = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vPosition;
      void main() {
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vPosition;

      // Compact 3D Hash
      vec3 hash(vec3 p) {
          p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
                   dot(p, vec3(269.5, 183.3, 246.1)),
                   dot(p, vec3(113.5, 271.9, 124.6)));
          return -1.0 + 2.0 * fract(sin(p) * 4375.85453123);
      }

      // 3D Noise
      float noise(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          vec3 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(dot(hash(i + vec3(0.0,0.0,0.0)), f - vec3(0.0,0.0,0.0)), 
                             dot(hash(i + vec3(1.0,0.0,0.0)), f - vec3(1.0,0.0,0.0)), u.x),
                         mix(dot(hash(i + vec3(0.0,1.0,0.0)), f - vec3(0.0,1.0,0.0)), 
                             dot(hash(i + vec3(1.0,1.0,0.0)), f - vec3(1.0,1.0,0.0)), u.x), u.y),
                     mix(mix(dot(hash(i + vec3(0.0,0.0,1.0)), f - vec3(0.0,0.0,1.0)), 
                             dot(hash(i + vec3(1.0,0.0,1.0)), f - vec3(1.0,0.0,1.0)), u.x),
                         mix(dot(hash(i + vec3(0.0,1.0,1.0)), f - vec3(0.0,1.0,1.0)), 
                             dot(hash(i + vec3(1.0,1.0,1.0)), f - vec3(1.0,1.0,1.0)), u.x), u.y), u.z);
      }

      // Fractional Brownian Motion (FBM)
      float fbm(vec3 x) {
          float v = 0.0;
          float a = 0.5;
          vec3 shift = vec3(100.0);
          for (int i = 0; i < 5; ++i) { 
              v += a * noise(x);
              x = x * 2.0 + shift;
              a *= 0.5;
          }
          return v;
      }

      void main() {
          vec3 p = normalize(vPosition);
          // Scale controls the size of the gas clouds. 
          // uTime creates the slow moving flow effect.
          vec3 q = p * 2.5 + uTime * 0.1; 
          
          float n = fbm(q);
          n = abs(n); // Turbulent clouds
          
          // Much brighter, vivid colors to ensure it's clearly visible
          vec3 colBase = vec3(0.04, 0.05, 0.15); // Deep space blue
          vec3 colNebula1 = vec3(0.4, 0.1, 0.7); // Bright purple
          vec3 colNebula2 = vec3(0.1, 0.6, 0.8); // Cyan/Blue
          vec3 colNebula3 = vec3(1.0, 0.3, 0.6); // Hot Pink
          
          vec3 finalCol = colBase;
          finalCol = mix(finalCol, colNebula1, smoothstep(0.1, 0.3, n));
          finalCol = mix(finalCol, colNebula2, smoothstep(0.25, 0.6, n));
          finalCol = mix(finalCol, colNebula3, smoothstep(0.5, 0.9, n));
          
          gl_FragColor = vec4(finalCol, 1.0);
      }
    `,
    uniforms: {
      uTime: { value: 0 }
    },
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false // Ensures it always renders behind everything
  });
  
  const nebulaMesh = new THREE.Mesh(nebulaGeo, shaderMat);
  nebulaMesh.renderOrder = -100; // Force it to render very first
  scene.add(nebulaMesh); // Add to scene directly so it doesn't inherit bgGroup rotation

  scene.add(bgGroup);
  return { bgGroup, shaderMat, nebulaMesh };
}

export default function GraphCanvas({ data, onNodeClick, highlightNodes, isHighlighting, selectedNodeId }) {
  const containerRef = useRef();
  const fgRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  
  // For animation loop
  const hoverStates = useRef(new Map());
  const sceneState = useRef({ backgroundInitialized: false, bgObjects: null });

  // Refs for stable callbacks
  const isDragging = useRef(false);
  const hoveredNodeIdRef = useRef(null);
  const propsRef = useRef({ highlightNodes, isHighlighting, selectedNodeId, nodesMap: new Map() });
  
  useEffect(() => {
    const nodesMap = new Map();
    if (data && data.nodes) {
      data.nodes.forEach(n => nodesMap.set(n.id, n));
    }
    propsRef.current = { highlightNodes, isHighlighting, selectedNodeId, nodesMap };
  }, [highlightNodes, isHighlighting, selectedNodeId, data]);

  // Convert array of categories to a color map for fast lookup
  const NODE_COLORS = useMemo(() => {
    return CATEGORIES.reduce((acc, cat) => {
      acc[cat.id] = cat.color;
      return acc;
    }, {});
  }, []);

  // Main Animation Loop
  useEffect(() => {
    let animationFrameId;
    
    const animate = () => {
      // 1. Initialize background if needed
      if (fgRef.current && !sceneState.current.backgroundInitialized) {
        const scene = fgRef.current.scene();
        if (scene) {
          sceneState.current.bgObjects = initSpaceBackground(scene);
          sceneState.current.backgroundInitialized = true;
        }
      }

      // 2. Animate 3D Background (Nebula & Stars)
      if (sceneState.current.bgObjects) {
        const { bgGroup, shaderMat, nebulaMesh } = sceneState.current.bgObjects;
        const time = Date.now();
        
        // Very slow parallax rotation for the whole galaxy (Stars)
        bgGroup.rotation.y += 0.0003;
        bgGroup.rotation.x += 0.0001;
        
        // Flowing nebula shader
        if (shaderMat) {
           shaderMat.uniforms.uTime.value = time * 0.0001;
        }

        // Keep the nebula skybox centered on the camera so we never fly out of it
        if (fgRef.current && nebulaMesh) {
          const cam = fgRef.current.camera();
          if (cam) {
            // Because bgGroup is rotating, we need to set world position or just apply inverse
            nebulaMesh.position.copy(cam.position);
          }
        }
      }

      // 3. Animate Node Hover States
      hoverStates.current.forEach((state, nodeId) => {
        const isHovered = hoveredNodeIdRef.current === nodeId || propsRef.current.selectedNodeId === nodeId;
        const target = isHovered ? 1 : 0;
        
        if (Math.abs(state.progress - target) > 0.01) {
          state.progress += (target - state.progress) * 0.12; 
        } else {
          state.progress = target; 
        }

        const node = propsRef.current.nodesMap.get(nodeId);
        if (node && node.__threeObj) {
          const group = node.__threeObj;
          const sphere = group.children[0];
          const sprite = group.children[1];
          const label = group.children[2];
          
          const p = state.progress;
          
          if (sphere) {
             const baseScale = 1 + p * 0.3;
             sphere.scale.set(baseScale, baseScale, baseScale);
          }
          if (sprite) {
             const spriteScale = 20 + p * 10;
             sprite.scale.set(spriteScale, spriteScale, 1);
             sprite.material.opacity = 0.5 + p * 0.5;
          }
          if (label) {
             label.position.y = 8 + p * 4;
             label.material.opacity = 0.7 + p * 0.3;
          }
        }
      });
      
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      if (entries.length > 0) {
        const { width, height } = entries[0].contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    
    return () => observer.disconnect();
  }, []);

  // Removed custom interval camera rotation that was fighting the user controls.
  // The OrbitControls built into react-force-graph-3d now handle mouse zoom/pan flawlessly,
  // while the scene background itself handles the majestic rotation.

  const createNodeObject = React.useCallback((node) => {
    const baseColor = NODE_COLORS[node.group] || '#ffffff';
    const { isHighlighting, highlightNodes } = propsRef.current;
    const isHighlighted = isHighlighting ? highlightNodes.has(node.id) : true;
    
    if (!hoverStates.current.has(node.id)) {
      hoverStates.current.set(node.id, { progress: 0 });
    }
    
    const opacity = isHighlighted ? 1 : 0.15;
    
    const group = new THREE.Group();
    
    // Core sphere (Star)
    const geometry = new THREE.SphereGeometry(3, 16, 16);
    const material = new THREE.MeshBasicMaterial({ 
      color: baseColor,
      transparent: true,
      opacity: opacity
    });
    const sphere = new THREE.Mesh(geometry, material);
    group.add(sphere);

    // Glow sprite (Aura)
    if (isHighlighted) {
      const spriteMaterial = new THREE.SpriteMaterial({
        map: getGlowTexture(baseColor),
        color: baseColor,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.5
      });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.scale.set(20, 20, 1);
      group.add(sprite);
    }

    // Label
    if (isHighlighted) {
      const spriteText = new SpriteText(node.name);
      spriteText.color = '#ffffff';
      spriteText.textHeight = 4;
      spriteText.fontFace = 'Inter, sans-serif';
      spriteText.position.y = 8;
      spriteText.material.transparent = true;
      spriteText.material.depthWrite = false;
      spriteText.material.opacity = 0.7;
      group.add(spriteText);
    }
    
    return group;
  }, [NODE_COLORS]);

  const handleNodeHover = React.useCallback((node) => {
    hoveredNodeIdRef.current = node ? node.id : null;
    if (containerRef.current) {
      containerRef.current.style.cursor = node ? 'pointer' : 'default';
    }
  }, []);

  const handleNodeClick = React.useCallback((node) => {
    if (fgRef.current) {
      const distance = 80;
      const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
      
      fgRef.current.cameraPosition(
        { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, 
        node, 
        1500
      );
    }
    onNodeClick(node);
  }, [onNodeClick]);
  
  const getLinkColor = React.useCallback((link) => {
     const { highlightNodes, isHighlighting, selectedNodeId } = propsRef.current;
     const hoveredNodeId = hoveredNodeIdRef.current;
     const sId = typeof link.source === 'object' ? link.source.id : link.source;
     const tId = typeof link.target === 'object' ? link.target.id : link.target;
     
     if (isHighlighting) {
       if (highlightNodes.has(sId) && highlightNodes.has(tId)) return 'rgba(255, 255, 255, 0.4)';
       return 'rgba(255, 255, 255, 0.02)';
     }
     
     if (hoveredNodeId || selectedNodeId) {
       const activeNode = hoveredNodeId || selectedNodeId;
       if (sId === activeNode || tId === activeNode) return 'rgba(255, 255, 255, 0.6)';
       return 'rgba(255, 255, 255, 0.05)';
     }

     return 'rgba(255, 255, 255, 0.15)';
  }, []);

  const getLinkWidth = React.useCallback((link) => {
     const { highlightNodes, isHighlighting, selectedNodeId } = propsRef.current;
     const hoveredNodeId = hoveredNodeIdRef.current;
     const sId = typeof link.source === 'object' ? link.source.id : link.source;
     const tId = typeof link.target === 'object' ? link.target.id : link.target;
     
     if (hoveredNodeId || selectedNodeId) {
       const activeNode = hoveredNodeId || selectedNodeId;
       if (sId === activeNode || tId === activeNode) return 1.5;
     }
     if (isHighlighting && highlightNodes.has(sId) && highlightNodes.has(tId)) return 1.2;
     return 0.5;
  }, []);

  return (
    <div 
      ref={containerRef} 
      style={{ width: '100%', height: '100%' }}
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={() => { isDragging.current = true; }}
      onMouseUp={() => { isDragging.current = false; }}
      onMouseLeave={() => { isDragging.current = false; }}
    >
      <ForceGraph3D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={data}
        nodeThreeObject={createNodeObject}
        onNodeHover={handleNodeHover}
        linkColor={getLinkColor}
        linkWidth={getLinkWidth}
        onNodeClick={handleNodeClick}
        backgroundColor="rgba(0,0,0,0)"
        showNavInfo={false}
      />
    </div>
  );
}
