import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import remarkFrontmatter from 'remark-frontmatter';

export default function MarkdownRenderer({ filepath, onNavigate }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    if (!filepath) return;
    
    setLoading(true);
    fetch(filepath)
      .then(res => {
        if (!res.ok) throw new Error('File not found');
        return res.text();
      })
      .then(text => {
        // 옵시디언의 형식 처리: ![[이미지]] 와 [[링크]]
        // 마크다운 파서가 띄어쓰기를 링크로 인식하지 못하는 문제를 막기 위해 인코딩 처리
        const parsedText = text
          .replace(/!\[\[(.*?)\]\]/g, (match, p1) => {
            const parts = p1.split('|');
            const filename = parts[0];
            const altText = parts[1] || filename; // If there's a |, use the second part as alt text
            return `![${altText}](obsidian-img://${encodeURIComponent(filename)})`;
          })
          .replace(/\[\[(.*?)\]\]/g, (match, p1) => {
            const parts = p1.split('|');
            const target = parts[0];
            const display = parts[1] || target;
            return `[${display}](obsidian-link://${encodeURIComponent(target)})`;
          });
        setContent(parsedText);
      })
      .catch(err => {
        console.error('Error fetching markdown:', err);
        setContent(`### 문서를 찾을 수 없습니다.\n\n\`${filepath}\` 파일이 존재하는지 확인해주세요.`);
      })
      .finally(() => setLoading(false));
  }, [filepath]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setSelectedImage(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (loading) return <div style={{ color: 'var(--text-muted)' }}>문서를 불러오는 중...</div>;
  if (!content) return null;

  return (
    <>
      <div className="markdown-content" style={{ lineHeight: 1.6, color: '#e2e8f0', fontSize: '0.95rem' }}>
        <ReactMarkdown 
          remarkPlugins={[remarkGfm, remarkFrontmatter]}
          rehypePlugins={[rehypeRaw]}
          components={{
            h1: ({node, ...props}) => <h1 {...props} />,
            h2: ({node, ...props}) => <h2 {...props} />,
            h3: ({node, ...props}) => <h3 {...props} />,
            p: ({node, ...props}) => <p {...props} />,
            ul: ({node, ...props}) => <ul {...props} />,
            ol: ({node, ...props}) => <ol {...props} />,
            li: ({node, ...props}) => <li {...props} />,
            blockquote: ({node, ...props}) => <blockquote {...props} />,
            img: ({node, src, alt, ...props}) => {
              let resolvedSrc = src;
              if (src && !src.startsWith('http') && !src.startsWith('data:')) {
                let baseDir = filepath.substring(0, filepath.lastIndexOf('/'));
                if (baseDir.startsWith('/')) baseDir = baseDir.substring(1);
                
                if (src.startsWith('obsidian-img://')) {
                  const filename = decodeURIComponent(src.replace('obsidian-img://', ''));
                  resolvedSrc = `/${baseDir}/media/${encodeURIComponent(filename)}`;
                } else {
                  let cleanSrc = src.startsWith('./') ? src.slice(2) : src;
                  if (!cleanSrc.includes('/')) {
                     cleanSrc = `media/${cleanSrc}`;
                  }
                  const encodedPath = cleanSrc.split('/').map(p => encodeURIComponent(decodeURIComponent(p))).join('/');
                  resolvedSrc = `/${baseDir}/${encodedPath}`;
                }
              }

              // Check if alt text is actually a meaningful caption (not just a filename/number)
              const isCaption = alt && !alt.startsWith('Pasted image') && isNaN(Number(alt));

              return (
                <span 
                  className="image-wrapper" 
                  style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', cursor: 'zoom-in', margin: '16px 0', width: '100%' }}
                  onClick={() => setSelectedImage({ src: resolvedSrc, alt: isCaption ? alt : '' })}
                >
                  <img src={resolvedSrc} alt={alt} style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px', margin: 0 }} {...props} />
                  {isCaption && (
                    <span style={{ fontSize: '0.85em', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center', display: 'block', width: '100%' }}>
                      {alt}
                    </span>
                  )}
                </span>
              );
            },
            a: ({node, href, children, ...props}) => {
              if (href && href.startsWith('obsidian-link://')) {
                const targetId = decodeURIComponent(href.replace('obsidian-link://', ''));
                return (
                  <a 
                    href="#" 
                    onClick={(e) => {
                      e.preventDefault();
                      if (onNavigate) onNavigate(targetId);
                    }}
                    style={{ color: 'var(--accent-color)', textDecoration: 'none', borderBottom: '1px dotted var(--accent-color)', cursor: 'pointer' }}
                    {...props}
                  >
                    {children}
                  </a>
                );
              }
              return <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color)' }} {...props}>{children}</a>;
            },
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

      {selectedImage && createPortal(
        <div className="lightbox-overlay" onClick={() => setSelectedImage(null)}>
          <img src={selectedImage.src} alt={selectedImage.alt} className="lightbox-img" onClick={(e) => e.stopPropagation()} />
          {selectedImage.alt && (
            <div className="lightbox-caption">{selectedImage.alt}</div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
