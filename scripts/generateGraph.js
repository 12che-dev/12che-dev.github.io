import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONTENT_DIR = path.resolve(__dirname, '../public/content');
const OUTPUT_FILE = path.resolve(__dirname, '../src/data/graphData.json');

function generateGraph() {
  if (!fs.existsSync(CONTENT_DIR)) {
    fs.mkdirSync(CONTENT_DIR, { recursive: true });
  }

  const files = fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.md'));
  
  const nodes = [];
  const links = [];

  files.forEach(file => {
    const filePath = path.join(CONTENT_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const { data } = matter(content);
    
    const id = file.replace('.md', '');
    
    const node = {
      id: id,
      name: data.title || id,
      group: parseInt(data.group) || 1,
      val: parseInt(data.val) || 10
    };
    
    nodes.push(node);
  });

  // Second pass to add links, ensuring target exists
  const nodeIds = new Set(nodes.map(n => n.id));
  
  files.forEach(file => {
    const filePath = path.join(CONTENT_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const { data } = matter(content);
    const id = file.replace('.md', '');

    if (data.links && Array.isArray(data.links)) {
      data.links.forEach(targetId => {
        // Only add link if target node exists!
        if (nodeIds.has(targetId)) {
          links.push({
            source: id,
            target: targetId
          });
        }
      });
    }
  });

  const graphData = { nodes, links };
  
  // Create src/data directory if it doesn't exist
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(graphData, null, 2));
  console.log(`[Sound Design Atlas] Graph generated: ${nodes.length} nodes, ${links.length} links.`);
}

generateGraph();
