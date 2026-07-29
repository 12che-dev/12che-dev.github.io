import React, { useRef, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

export default function GraphCanvas({ data, onNodeClick, highlightNodes, isHighlighting, selectedNodeId }) {
  const containerRef = useRef();
  const fgRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  
  // For animation loop
  const hoverStates = useRef(new Map());
  const [, setRenderTick] = useState(0);

  // Refs for stable callbacks
  const isDragging = useRef(false);
  const hoveredNodeIdRef = useRef(null);
  const propsRef = useRef({ highlightNodes, isHighlighting, selectedNodeId });
  
  useEffect(() => {
    propsRef.current = { highlightNodes, isHighlighting, selectedNodeId };
  }, [highlightNodes, isHighlighting, selectedNodeId]);

  // Animation Loop Effect
  useEffect(() => {
    let animationFrameId;
    
    const animate = () => {
      let needsRedraw = false;
      
      hoverStates.current.forEach((state, nodeId) => {
        const isHovered = hoveredNodeIdRef.current === nodeId || propsRef.current.selectedNodeId === nodeId;
        const target = isHovered ? 1 : 0;
        
        if (Math.abs(state.progress - target) > 0.01) {
          state.progress += (target - state.progress) * 0.12; 
          needsRedraw = true;
        } else {
          state.progress = target; 
        }
      });

      if (needsRedraw && !isDragging.current) {
        setRenderTick(t => t + 1); 
      }
      
      animationFrameId = requestAnimationFrame(animate);
    };
    
    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, []); // No dependencies, runs forever smoothly

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
  }, []); // No dependencies, runs forever smoothly

  const NODE_COLORS = {
    1: '#00f0ff',
    2: '#ff007f',
    3: '#a855f7',
    4: '#10b981'
  };

  const hexToRgba = (hex, op) => {
    if (!hex) return `rgba(255, 255, 255, ${op})`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${op})`;
  };

  const paintNode = React.useCallback((node, ctx, globalScale) => {
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;

    const label = node.name;
    const fontSize = 12 / globalScale;
    ctx.font = `${fontSize}px Inter, sans-serif`;
    
    const baseColor = NODE_COLORS[node.group] || '#ffffff';
    const { isHighlighting, highlightNodes } = propsRef.current;
    const isHighlighted = isHighlighting ? highlightNodes.has(node.id) : true;
    
    if (!hoverStates.current.has(node.id)) {
      hoverStates.current.set(node.id, { progress: 0 });
    }
    const progress = hoverStates.current.get(node.id).progress;
    
    const baseR = 3.0 + (1.5 * progress); 

    if (isHighlighted) {
      const coronaR = baseR * (4 + (3 * progress)); 
      const coronaOpacity = 0.05 + (0.05 * progress); 
      
      const coronaGradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, coronaR);
      coronaGradient.addColorStop(0, hexToRgba(baseColor, coronaOpacity));
      coronaGradient.addColorStop(1, hexToRgba(baseColor, 0));
      
      ctx.beginPath();
      ctx.arc(node.x, node.y, coronaR, 0, 2 * Math.PI, false);
      ctx.fillStyle = coronaGradient;
      ctx.fill();

      const glowR = baseR * (2 + (1.5 * progress)); 
      const glowGradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowR);
      glowGradient.addColorStop(0, hexToRgba(baseColor, 0.5 + (0.3 * progress)));
      glowGradient.addColorStop(1, hexToRgba(baseColor, 0));
      
      ctx.beginPath();
      ctx.arc(node.x, node.y, glowR, 0, 2 * Math.PI, false);
      ctx.fillStyle = glowGradient;
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(node.x, node.y, baseR * (0.5 + 0.1 * progress), 0, 2 * Math.PI, false);
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 4 + (4 * progress);
      ctx.shadowColor = '#ffffff';
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = `rgba(255, 255, 255, ${0.7 + (0.3 * progress)})`;
      ctx.shadowBlur = 4;
      ctx.shadowColor = '#000000'; 
      ctx.fillText(label, node.x, node.y + 10 + (4 * progress));
      ctx.shadowBlur = 0; 
    } else {
      ctx.beginPath();
      ctx.arc(node.x, node.y, baseR, 0, 2 * Math.PI, false);
      ctx.fillStyle = hexToRgba(baseColor, 0.15);
      ctx.fill();
    }
  }, []); // Stable reference!

  const handleNodeHover = React.useCallback((node) => {
    hoveredNodeIdRef.current = node ? node.id : null;
    if (!isDragging.current) setRenderTick(t => t + 1);
  }, []);

  const handleNodeClick = React.useCallback((node) => {
    if (fgRef.current) {
      fgRef.current.centerAt(node.x, node.y, 800);
      fgRef.current.zoom(2.5, 800);
    }
    // Access original prop via ref if needed, or we can just rely on closure since onNodeClick rarely changes
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
       return 'rgba(255, 255, 255, 0.03)';
     }
     
     if (hoveredNodeId || selectedNodeId) {
       const activeNode = hoveredNodeId || selectedNodeId;
       if (sId === activeNode || tId === activeNode) {
         return 'rgba(255, 255, 255, 0.5)';
       }
       return 'rgba(255, 255, 255, 0.05)';
     }

     return 'rgba(255, 255, 255, 0.15)';
  }, []); // Stable reference!

  const getLinkWidth = React.useCallback((link) => {
     const { highlightNodes, isHighlighting, selectedNodeId } = propsRef.current;
     const hoveredNodeId = hoveredNodeIdRef.current;
     const sId = typeof link.source === 'object' ? link.source.id : link.source;
     const tId = typeof link.target === 'object' ? link.target.id : link.target;
     
     if (hoveredNodeId || selectedNodeId) {
       const activeNode = hoveredNodeId || selectedNodeId;
       if (sId === activeNode || tId === activeNode) return 2;
     }
     if (isHighlighting && highlightNodes.has(sId) && highlightNodes.has(tId)) return 1.5;
     return 1;
  }, []); // Stable reference!

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={data}
        nodeRelSize={4}
        onNodeHover={handleNodeHover}
        linkColor={getLinkColor}
        linkWidth={getLinkWidth}
        onNodeClick={handleNodeClick}
        onNodeDragStart={() => { isDragging.current = true; }}
        onNodeDragEnd={() => { isDragging.current = false; }}
        backgroundColor="transparent"
        nodeCanvasObject={paintNode}
        d3VelocityDecay={0.3}
      />
    </div>
  );
}
