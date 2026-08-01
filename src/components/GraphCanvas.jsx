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

// Texture generators with Anti-Banding (Dithering)
function createGlowTexture(r, g, b, a, soft = false) {
  const canvas = document.createElement('canvas');
  const size = soft ? 512 : 128; // Massive resolution for soft clouds so noise doesn't scale up
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  const center = size / 2;
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  
  if (soft) {
    // Smoother multi-stop curve to hide harsh edges
    gradient.addColorStop(0, `rgba(${r},${g},${b},${a})`);
    gradient.addColorStop(0.3, `rgba(${r},${g},${b},${a * 0.7})`);
    gradient.addColorStop(0.6, `rgba(${r},${g},${b},${a * 0.2})`);
    gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
  } else {
    // Sharper gradient for node stars
    gradient.addColorStop(0, `rgba(${r},${g},${b},${a})`);
    gradient.addColorStop(0.15, `rgba(${r},${g},${b},${a})`);
    gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
  }
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  
  // Dithering: Add subtle noise to eliminate color banding (rings)
  if (soft) {
    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i+3] > 0) { // Only affect non-transparent pixels
        // Reduced noise multiplier from 5 to 1.5 so it doesn't look grainy when zoomed
        const noise = (Math.random() - 0.5) * 1.5; 
        data[i] = Math.min(255, Math.max(0, data[i] + noise));
        data[i+1] = Math.min(255, Math.max(0, data[i+1] + noise));
        data[i+2] = Math.min(255, Math.max(0, data[i+2] + noise));
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }
  
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

const GLOW_TEXTURES = {};
function getGlowTexture(hexColor) {
  if (!GLOW_TEXTURES[hexColor]) {
    const { r, g, b } = hexToRgb(hexColor);
    GLOW_TEXTURES[hexColor] = createGlowTexture(r, g, b, 1.0, false);
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

  // 2. Volumetric Nebula Gas Clouds (Sprites)
  const cloudCount = 50;
  // Use RGB + Alpha for the anti-banding texture generator
  const cloudTexBlue = createGlowTexture(40, 80, 220, 0.12, true);
  const cloudTexPurple = createGlowTexture(140, 40, 200, 0.12, true);
  const cloudTexPink = createGlowTexture(200, 50, 150, 0.08, true);
  const cloudTexDarkBlue = createGlowTexture(10, 30, 100, 0.25, true);
  
  const textures = [cloudTexBlue, cloudTexPurple, cloudTexPink, cloudTexDarkBlue];
  
  const clouds = [];
  for(let i=0; i < cloudCount; i++) {
    const mat = new THREE.SpriteMaterial({
      map: textures[Math.floor(Math.random() * textures.length)],
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.3 + Math.random() * 0.7,
      dithering: true // Native Three.js dithering to help with banding
    });
    const sprite = new THREE.Sprite(mat);
    
    // Place clouds WAY far away so camera doesn't fly through them
    const r = 3000 + Math.random() * 2000;
    const theta = 2 * Math.PI * Math.random();
    // Concentrate near the equator for a 'rift' look, but allow some spread
    const phi = Math.PI/2 + (Math.random() - 0.5) * 1.5; 
    
    sprite.position.x = r * Math.sin(phi) * Math.cos(theta);
    sprite.position.y = r * Math.sin(phi) * Math.sin(theta);
    sprite.position.z = r * Math.cos(phi);
    
    // Scale up proportionally since they are further away
    const scale = 3000 + Math.random() * 4000;
    sprite.scale.set(scale, scale, 1);
    
    // Initial random rotation for variety
    sprite.material.rotation = Math.random() * Math.PI * 2;

    sprite.userData = {
      rotSpeed: (Math.random() - 0.5) * 0.002,
      pulseSpeed: 0.001 + Math.random() * 0.001,
      baseScale: scale,
      phase: Math.random() * Math.PI * 2
    };
    
    clouds.push(sprite);
    bgGroup.add(sprite);
  }

  scene.add(bgGroup);
  return { bgGroup, clouds };
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
        const { bgGroup, clouds } = sceneState.current.bgObjects;
        const time = Date.now();
        
        // Very slow parallax rotation for the whole galaxy
        bgGroup.rotation.y += 0.0003;
        bgGroup.rotation.x += 0.0001;
        
        // Dynamic volumetric clouds pulsing and twisting
        clouds.forEach(cloud => {
           cloud.material.rotation += cloud.userData.rotSpeed;
           const scale = cloud.userData.baseScale * (1 + 0.15 * Math.sin(time * cloud.userData.pulseSpeed + cloud.userData.phase));
           cloud.scale.set(scale, scale, 1);
        });
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
