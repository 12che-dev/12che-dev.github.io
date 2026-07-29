import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import remarkFrontmatter from 'remark-frontmatter';

export default function MarkdownRenderer({ filepath }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!filepath) return;
    
    setLoading(true);
    fetch(filepath)
      .then(res => {
        if (!res.ok) throw new Error('File not found');
        return res.text();
      })
      .then(text => setContent(text))
      .catch(err => setContent(`### 문서를 찾을 수 없습니다.\n\n\`${filepath}\` 파일이 존재하는지 확인해주세요.`))
      .finally(() => setLoading(false));
  }, [filepath]);

  if (loading) return <div style={{ color: 'var(--text-muted)' }}>문서를 불러오는 중...</div>;
  if (!content) return null;

  return (
    <div className="markdown-content" style={{ lineHeight: 1.6, color: '#e2e8f0', fontSize: '0.95rem' }}>
      <ReactMarkdown 
        remarkPlugins={[remarkGfm, remarkFrontmatter]}
        rehypePlugins={[rehypeRaw]}
        components={{
          h1: ({node, ...props}) => <h1 style={{ fontSize: '1.8em', borderBottom: '1px solid var(--panel-border)', paddingBottom: '8px', marginBottom: '16px', color: '#fff' }} {...props} />,
          h2: ({node, ...props}) => <h2 style={{ fontSize: '1.4em', marginTop: '24px', marginBottom: '12px', color: 'var(--accent-color)' }} {...props} />,
          h3: ({node, ...props}) => <h3 style={{ fontSize: '1.2em', marginTop: '20px', marginBottom: '12px' }} {...props} />,
          p: ({node, ...props}) => <p style={{ marginBottom: '16px' }} {...props} />,
          ul: ({node, ...props}) => <ul style={{ paddingLeft: '24px', marginBottom: '16px' }} {...props} />,
          li: ({node, ...props}) => <li style={{ marginBottom: '8px' }} {...props} />,
          blockquote: ({node, ...props}) => (
            <blockquote style={{ 
              borderLeft: '4px solid var(--accent-color)', 
              paddingLeft: '16px', 
              margin: '16px 0', 
              color: 'var(--text-muted)',
              background: 'rgba(0, 240, 255, 0.05)',
              padding: '12px 16px',
              borderRadius: '0 4px 4px 0'
            }} {...props} />
          ),
          code: ({node, inline, className, children, ...props}) => {
            return inline ? (
              <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.9em' }} {...props}>
                {children}
              </code>
            ) : (
              <pre style={{ background: 'rgba(0,0,0,0.5)', padding: '16px', borderRadius: '8px', overflowX: 'auto', marginBottom: '16px' }}>
                <code style={{ fontFamily: 'monospace', fontSize: '0.9em' }} {...props}>
                  {children}
                </code>
              </pre>
            );
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
