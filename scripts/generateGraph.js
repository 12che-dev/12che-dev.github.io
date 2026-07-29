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

  function getAllMdFiles(dirPath, arrayOfFiles = []) {
    const files = fs.readdirSync(dirPath);
    files.forEach(file => {
      const fullPath = path.join(dirPath, file);
      if (fs.statSync(fullPath).isDirectory()) {
        getAllMdFiles(fullPath, arrayOfFiles);
      } else if (file.endsWith('.md')) {
        arrayOfFiles.push(fullPath);
      }
    });
    return arrayOfFiles;
  }

  const files = getAllMdFiles(CONTENT_DIR);
  const nodes = [];
  const links = [];

  files.forEach(file => {
    const filePath = file; // file is already absolute path
    const content = fs.readFileSync(filePath, 'utf-8');
    const { data } = matter(content);
    
    const id = path.basename(file, '.md');
    const relativePath = path.relative(CONTENT_DIR, file).replace(/\\/g, '/');
    
    const node = {
      id: id,
      path: relativePath,
      name: data.title || id,
      group: parseInt(data.group) || 1,
      val: parseInt(data.val) || 10
    };
    
    nodes.push(node);
  });

  // Second pass to add links, ensuring target exists
  const nodeIds = new Set(nodes.map(n => n.id));
  
  files.forEach(file => {
    const filePath = file; // file is already absolute path
    const content = fs.readFileSync(filePath, 'utf-8');
    const { data } = matter(content);
    const id = path.basename(file, '.md');

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
