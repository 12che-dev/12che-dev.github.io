import React, { useState } from 'react';
import GraphCanvas from './components/GraphCanvas';
import MarkdownRenderer from './components/MarkdownRenderer';
import graphData from './data/graphData.json';
import { Search } from 'lucide-react';

const CATEGORIES = [
  { id: 1, name: '사운드 디자인 이론', color: '#00f0ff' },
  { id: 2, name: '엔진 / 미들웨어', color: '#ff007f' },
  { id: 3, name: '강연 리뷰 (GDC 등)', color: '#a855f7' },
  { id: 4, name: '역기획서 / 분석', color: '#10b981' }
];

function App() {
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const handleNodeClick = (node) => {
    setSelectedNode(node);
  };

  const closePanel = () => {
    setSelectedNode(null);
  };

  const toggleCategory = (categoryId) => {
    if (selectedCategory === categoryId) {
      setSelectedCategory(null);
    } else {
      setSelectedCategory(categoryId);
    }
  };

  const highlightNodes = new Set();
  
  if (selectedCategory !== null) {
    graphData.nodes.forEach(node => {
      if (node.group === selectedCategory) {
        highlightNodes.add(node.id);
      }
    });
  }

  return (
    <div className="app-container">
      {/* Left Sidebar */}
      <aside className="sidebar">
        <div className="header">
          <h1>SOUND DESIGN ATLAS</h1>
        </div>
        
        <div style={{ padding: '24px' }}>
          <div className="search-box">
            <Search size={16} color="var(--text-muted)" style={{ marginRight: '8px' }} />
            <input 
              type="text" 
              placeholder="노드 검색..." 
            />
          </div>

          <h3 className="section-title">SECTORS</h3>
          <ul className="category-list">
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <li 
                  key={cat.id} 
                  className={`category-item ${isActive ? 'active' : ''}`}
                  onClick={() => toggleCategory(cat.id)}
                >
                  <span className="category-dot" style={{ 
                    backgroundColor: cat.color,
                    boxShadow: isActive ? `0 0 10px ${cat.color}` : 'none'
                  }}></span>
                  <span style={{ opacity: selectedCategory !== null && !isActive ? 0.4 : 1, transition: 'opacity 0.2s' }}>
                    {cat.name}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      {/* Main Graph Canvas */}
      <main className="canvas-container">
        <GraphCanvas 
          data={graphData} 
          onNodeClick={handleNodeClick} 
          highlightNodes={highlightNodes}
          isHighlighting={selectedCategory !== null}
          selectedNodeId={selectedNode ? selectedNode.id : null}
        />
      </main>

      {/* Right Detail Panel */}
      <aside className={`detail-panel ${selectedNode ? 'open' : ''}`}>
        {selectedNode && (
          <>
            <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ 
                  display: 'inline-block', 
                  width: '10px', 
                  height: '10px', 
                  borderRadius: '50%', 
                  backgroundColor: CATEGORIES.find(c => c.id === selectedNode.group)?.color || '#fff',
                  marginRight: '12px',
                  boxShadow: `0 0 10px ${CATEGORIES.find(c => c.id === selectedNode.group)?.color || '#fff'}`
                }}></span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {CATEGORIES.find(c => c.id === selectedNode.group)?.name || 'UNKNOWN'}
                </span>
              </div>
              <button onClick={closePanel} className="close-btn">✕</button>
            </div>
            
            <div style={{ padding: '32px 24px', overflowY: 'auto', flexGrow: 1 }}>
              <h2 style={{ fontSize: '1.6rem', color: '#fff', marginBottom: '8px', lineHeight: 1.3 }}>
                {selectedNode.name}
              </h2>
              
              <MarkdownRenderer fileId={selectedNode.id} />
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

export default App;
