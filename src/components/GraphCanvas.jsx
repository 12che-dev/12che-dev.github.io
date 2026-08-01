import React, { useRef, useEffect, useState, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import SpriteText from 'three-spritetext';
import { CATEGORIES } from '../config';

// Glow texture generator for star nodes
function createGlowTexture(colorStr) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, colorStr);
  gradient.addColorStop(0.2, colorStr);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

const GLOW_TEXTURES = {};
function getGlowTexture(color) {
  if (!GLOW_TEXTURES[color]) {
    GLOW_TEXTURES[color] = createGlowTexture(color);
  }
  return GLOW_TEXTURES[color];
}

export default function GraphCanvas({ data, onNodeClick, highlightNodes, isHighlighting, selectedNodeId }) {
  const containerRef = useRef();
  const fgRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  
  // For animation loop
  const hoverStates = useRef(new Map());

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

  // Animation Loop Effect (runs smoothly to animate hover states in 3D)
  useEffect(() => {
    let animationFrameId;
    
    const animate = () => {
      hoverStates.current.forEach((state, nodeId) => {
        const isHovered = hoveredNodeIdRef.current === nodeId || propsRef.current.selectedNodeId === nodeId;
        const target = isHovered ? 1 : 0;
        
        if (Math.abs(state.progress - target) > 0.01) {
          state.progress += (target - state.progress) * 0.12; 
        } else {
          state.progress = target; 
        }

        // Directly mutate the ThreeJS object to animate hover smoothly
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

  // Add auto-rotation
  useEffect(() => {
    if (fgRef.current) {
      // Gently rotate the camera to feel like space
      let angle = 0;
      const interval = setInterval(() => {
        if (!hoveredNodeIdRef.current && !propsRef.current.selectedNodeId && !isDragging.current) {
          // Only rotate if not interacting
          angle += Math.PI / 1500;
          const distance = 400; // orbit distance
          fgRef.current.cameraPosition({
            x: distance * Math.sin(angle),
            z: distance * Math.cos(angle)
          });
        }
      }, 30);
      return () => clearInterval(interval);
    }
  }, [data]);

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

    // Glow sprite (Nebula aura)
    if (isHighlighted) {
      const spriteMaterial = new THREE.SpriteMaterial({
        map: getGlowTexture(baseColor),
        color: baseColor,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false, // Prevents glowing square artifacts
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
      if (node) {
        containerRef.current.style.cursor = 'pointer';
      } else {
        containerRef.current.style.cursor = 'default';
      }
    }
  }, []);

  const handleNodeClick = React.useCallback((node) => {
    if (fgRef.current) {
      // Focus camera on node in 3D space
      const distance = 80;
      const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
      
      fgRef.current.cameraPosition(
        { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, 
        node, 
        1500  // ms transition duration
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
       if (highlightNodes.has(sId) && highlightNodes.has(tId)) {
         return 'rgba(255, 255, 255, 0.4)';
       }
       return 'rgba(255, 255, 255, 0.02)';
     }
     
     if (hoveredNodeId || selectedNodeId) {
       const activeNode = hoveredNodeId || selectedNodeId;
       if (sId === activeNode || tId === activeNode) {
         return 'rgba(255, 255, 255, 0.6)';
       }
       return 'rgba(255, 255, 255, 0.05)';
     }

     return 'rgba(255, 255, 255, 0.2)';
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
