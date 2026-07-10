import { useState, useRef, useEffect } from "react";
import { 
  ArrowRight, Code, Copy, Cpu, Database, FileCode, 
  GitBranch, Globe, HardDrive, Layers, Play, RefreshCw, 
  Save, Server, Shield, Smartphone, Zap, Terminal, Plus, Trash2, Combine, Palette, X,
  Upload, Download, FileArchive, Check, Edit3, Link2, Eye, Workflow
} from "lucide-react";
import { cn } from "@/lib/utils";
import JSZip from "jszip";
import { downloadZip } from "client-zip";
import { saveAs } from "file-saver";
import Stitcher from "@/components/Stitcher";
import LogicLayer from "@/components/LogicLayer";

// SketchIDE Integration ID
const SKETCHIDE_ID = "com.sketchide.app";
const SKETCHIDE_CHANNEL = "com.sketchide.app/storage_permission";
const SKETCHIDE_VERSION = "1.0.0";

import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Types for our Causal Blocks
type BlockType = 'movement' | 'evolution' | 'being' | 'design' | 'space' | 'zip' | 'doc';

interface CausalNode {
  id: string;
  fromBlockId: string;
  toBlockId: string;
  condition: string;  // IF condition
  action: string;     // THEN action
}

interface CausalBlock {
  id: string;
  type: BlockType;
  label: string;
  content: string;
  color: string;
  inputs: string[];
  outputs: string[];
  files?: Record<string, string>;
  x: number;
  y: number;
}

export default function Foundry() {
  const [blocks, setBlocks] = useState<CausalBlock[]>([]);
  const [selectedBlockIds, setSelectedBlockIds] = useState<Set<string>>(new Set());
  const [generatedCode, setGeneratedCode] = useState("// Causal Graph Output\n// Ready to construct...");
  const [consoleLog, setConsoleLog] = useState<string[]>(["System initialized."]);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isStitcherOpen, setIsStitcherOpen] = useState(false);
  const [isLogicLayerOpen, setIsLogicLayerOpen] = useState(false);
  const [runningBlockId, setRunningBlockId] = useState<string | null>(null);
  const [previewOutput, setPreviewOutput] = useState<string>("");
  const [causalNodes, setCausalNodes] = useState<CausalNode[]>([]);
  const [isLinkingMode, setIsLinkingMode] = useState(false);
  const [linkSourceId, setLinkSourceId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [inferenceMode, setInferenceMode] = useState(false);
  const [tracedPath, setTracedPath] = useState<string[]>([]);
  const [inferenceResults, setInferenceResults] = useState<string[]>([]);
  const [projectorBlockId, setProjectorBlockId] = useState<string | null>(null);
  const [projectorEditingFile, setProjectorEditingFile] = useState<string | null>(null);
  const [projectorEditContent, setProjectorEditContent] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // ZIP Projector - Open block to see/edit files
  const openProjector = (blockId: string) => {
    setProjectorBlockId(blockId);
    setProjectorEditingFile(null);
    addToLog(`Opened projector for block`);
  };

  const closeProjector = () => {
    setProjectorBlockId(null);
    setProjectorEditingFile(null);
    setProjectorEditContent("");
  };

  const projectorBlock = projectorBlockId ? blocks.find(b => b.id === projectorBlockId) : null;

  const startEditingFile = (filename: string) => {
    if (projectorBlock?.files?.[filename]) {
      setProjectorEditingFile(filename);
      setProjectorEditContent(projectorBlock.files[filename]);
    }
  };

  const saveFileEdit = () => {
    if (projectorBlockId && projectorEditingFile) {
      setBlocks(prev => prev.map(b => {
        if (b.id === projectorBlockId && b.files) {
          return {
            ...b,
            files: { ...b.files, [projectorEditingFile]: projectorEditContent }
          };
        }
        return b;
      }));
      addToLog(`Saved ${projectorEditingFile}`);
      setProjectorEditingFile(null);
    }
  };

  const deleteFileFromBlock = (filename: string) => {
    if (projectorBlockId) {
      setBlocks(prev => prev.map(b => {
        if (b.id === projectorBlockId && b.files) {
          const newFiles = { ...b.files };
          delete newFiles[filename];
          return { ...b, files: newFiles };
        }
        return b;
      }));
      addToLog(`Deleted ${filename}`);
    }
  };

  const renameFile = (oldName: string, newName: string) => {
    if (projectorBlockId && oldName !== newName) {
      setBlocks(prev => prev.map(b => {
        if (b.id === projectorBlockId && b.files) {
          const newFiles: Record<string, string> = {};
          Object.entries(b.files).forEach(([k, v]) => {
            newFiles[k === oldName ? newName : k] = v;
          });
          return { ...b, files: newFiles };
        }
        return b;
      }));
      addToLog(`Renamed ${oldName} → ${newName}`);
    }
  };

  const startLinking = (sourceId: string) => {
    setIsLinkingMode(true);
    setLinkSourceId(sourceId);
    addToLog(`Select target block to create causal node...`);
  };

  const completeLinking = (targetId: string) => {
    if (linkSourceId && linkSourceId !== targetId) {
      const newNode: CausalNode = {
        id: Math.random().toString(36).substr(2, 9),
        fromBlockId: linkSourceId,
        toBlockId: targetId,
        condition: 'true',
        action: 'execute'
      };
      setCausalNodes(prev => [...prev, newNode]);
      setEditingNodeId(newNode.id);
      addToLog(`Causal node created: ${linkSourceId} -> ${targetId}`);
    }
    setIsLinkingMode(false);
    setLinkSourceId(null);
  };

  const updateNode = (id: string, updates: Partial<CausalNode>) => {
    setCausalNodes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
  };

  const deleteNode = (id: string) => {
    setCausalNodes(prev => prev.filter(n => n.id !== id));
    addToLog(`Causal node deleted`);
  };

  const getNodesForBlock = (blockId: string) => {
    return causalNodes.filter(n => n.fromBlockId === blockId || n.toBlockId === blockId);
  };

  const traceCausalPath = (startBlockId: string) => {
    const path: string[] = [startBlockId];
    const results: string[] = [];
    const visited = new Set<string>();
    
    const traverse = (blockId: string, depth: number) => {
      if (visited.has(blockId) || depth > 10) return;
      visited.add(blockId);
      
      const block = blocks.find(b => b.id === blockId);
      const outgoing = causalNodes.filter(n => n.fromBlockId === blockId);
      
      outgoing.forEach(node => {
        const targetBlock = blocks.find(b => b.id === node.toBlockId);
        if (targetBlock) {
          path.push(node.toBlockId);
          results.push(`IF ${node.condition} → THEN ${node.action} → ${targetBlock.label}`);
          traverse(node.toBlockId, depth + 1);
        }
      });
    };
    
    const startBlock = blocks.find(b => b.id === startBlockId);
    if (startBlock) {
      results.unshift(`Start: ${startBlock.label}`);
    }
    traverse(startBlockId, 0);
    
    setTracedPath(path);
    setInferenceResults(results);
    addToLog(`Traced causal path from ${startBlock?.label}: ${path.length} blocks`);
  };

  const runVisualInference = (blockId: string) => {
    if (!inferenceMode) {
      setInferenceMode(true);
      traceCausalPath(blockId);
    } else {
      setInferenceMode(false);
      setTracedPath([]);
      setInferenceResults([]);
    }
  };

  const addBlock = (type: BlockType, label: string) => {
    const newBlock: CausalBlock = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      label,
      content: `// Logic for ${label}\nclass ${label.replace(/\s/g, '')} {\n  init() { ... }\n}`,
      color: type === 'zip' ? '#FFD700' : type === 'doc' ? '#60A5FA' : `var(--${type})`,
      inputs: [],
      outputs: [],
      x: 50 + (blocks.length % 3) * 220,
      y: 50 + Math.floor(blocks.length / 3) * 150
    };
    setBlocks([...blocks, newBlock]);
    addToLog(`Stamped [${type.toUpperCase()}] block: ${label}`);
    updateCode([...blocks, newBlock]);
  };

  const updateBlockPosition = (id: string, x: number, y: number) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, x, y } : b));
  };

  const handleTouchStart = (e: React.TouchEvent, block: CausalBlock) => {
    e.stopPropagation();
    const touch = e.touches[0];
    const rect = (e.target as HTMLElement).closest('[data-block]')?.getBoundingClientRect();
    if (rect) {
      dragOffset.current = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    setDraggingId(block.id);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!draggingId || !canvasRef.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const newX = touch.clientX - canvasRect.left - dragOffset.current.x;
    const newY = touch.clientY - canvasRect.top - dragOffset.current.y;
    updateBlockPosition(draggingId, Math.max(0, newX), Math.max(0, newY));
  };

  const handleTouchEnd = () => setDraggingId(null);

  const handleMouseDown = (e: React.MouseEvent, block: CausalBlock) => {
    e.stopPropagation();
    const rect = (e.target as HTMLElement).closest('[data-block]')?.getBoundingClientRect();
    if (rect) {
      dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    setDraggingId(block.id);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingId || !canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const newX = e.clientX - canvasRect.left - dragOffset.current.x;
    const newY = e.clientY - canvasRect.top - dragOffset.current.y;
    updateBlockPosition(draggingId, Math.max(0, newX), Math.max(0, newY));
  };

  const handleMouseUp = () => setDraggingId(null);

  const executeBlock = (block: CausalBlock) => {
    setRunningBlockId(block.id);
    addToLog(`Executing ${block.label}...`);
    
    try {
      if (block.files) {
        const jsFiles = Object.entries(block.files).filter(([name]) => name.match(/\.(js|jsx|ts|tsx)$/i));
        if (jsFiles.length > 0) {
          const [fileName, code] = jsFiles[0];
          addToLog(`Running ${fileName}...`);
          const safeCode = `
            (function() {
              const console = { log: (...args) => window.__runtimeLog(args.join(' ')) };
              ${code}
            })()
          `;
          (window as any).__runtimeLog = (msg: string) => {
            setPreviewOutput(prev => prev + msg + '\\n');
            addToLog(msg);
          };
          try {
            new Function(safeCode)();
            addToLog(`Executed ${fileName} successfully`);
          } catch (err: any) {
            addToLog(`Runtime error: ${err.message}`);
          }
        } else {
          setPreviewOutput(Object.values(block.files)[0] || block.content);
          addToLog(`Previewing content...`);
        }
      } else {
        setPreviewOutput(block.content);
        addToLog(`Previewing block content...`);
      }
    } catch (err: any) {
      addToLog(`Error: ${err.message}`);
    }
    
    setTimeout(() => setRunningBlockId(null), 500);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    addToLog(`Reading ${file.name}...`);
    
    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      let newBlock: CausalBlock | null = null;

      if (extension === 'zip') {
        // ... existing ZIP logic ...
        const zip = new JSZip();
        const contents = await zip.loadAsync(file);
        const files: Record<string, string> = {};
        
        for (const [filename, zipEntry] of Object.entries(contents.files)) {
          if (!zipEntry.dir && !filename.includes('__MACOSX')) {
             if (filename.match(/\.(js|jsx|ts|tsx|json|md|txt|css|html)$/i)) {
               files[filename] = await zipEntry.async("text");
             }
          }
        }

        newBlock = {
          id: Math.random().toString(36).substr(2, 9),
          type: 'zip',
          label: file.name.replace('.zip', ''),
          content: `// Imported from ${file.name}\n// Contains ${Object.keys(files).length} files`,
          color: '#FFD700',
          inputs: [],
          outputs: [],
          files: files,
          x: 50 + (blocks.length % 3) * 220,
          y: 50 + Math.floor(blocks.length / 3) * 150
        };

      } else if (['json', 'js', 'ts', 'jsx', 'tsx', 'txt', 'md', 'html', 'css'].includes(extension || '')) {
        // Text/Code files
        const text = await file.text();
        newBlock = {
          id: Math.random().toString(36).substr(2, 9),
          type: 'zip',
          label: file.name,
          content: text,
          color: extension === 'json' ? '#FBBF24' : '#60A5FA',
          inputs: [],
          outputs: [],
          files: { [file.name]: text },
          x: 50 + (blocks.length % 3) * 220,
          y: 50 + Math.floor(blocks.length / 3) * 150
        };

      } else if (extension === 'docx') {
        // Word Documents
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        const text = result.value;
        
        newBlock = {
          id: Math.random().toString(36).substr(2, 9),
          type: 'doc',
          label: file.name,
          content: `/**\n * Extracted from ${file.name}\n * \n * ${text.replace(/\n/g, '\n * ')}\n */`,
          color: '#2563EB',
          inputs: [],
          outputs: [],
          files: { [`${file.name}.txt`]: text },
          x: 50 + (blocks.length % 3) * 220,
          y: 50 + Math.floor(blocks.length / 3) * 150
        };
        if (result.messages.length > 0) {
          addToLog(`Word parsing warnings: ${result.messages.map(m => m.message).join(', ')}`);
        }

      } else if (extension === 'pdf') {
        // PDFs
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        let fullText = '';
        
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += `\n// --- Page ${i} ---\n${pageText}\n`;
        }

        newBlock = {
          id: Math.random().toString(36).substr(2, 9),
          type: 'doc',
          label: file.name,
          content: `/**\n * Extracted from PDF: ${file.name}\n * Pages: ${pdf.numPages}\n */\n${fullText}`,
          color: '#DC2626',
          inputs: [],
          outputs: [],
          files: { [`${file.name}.txt`]: fullText },
          x: 50 + (blocks.length % 3) * 220,
          y: 50 + Math.floor(blocks.length / 3) * 150
        };
      }

      if (newBlock) {
        setBlocks(prev => [...prev, newBlock!]);
        addToLog(`Imported ${file.name} successfully.`);
      } else {
        addToLog(`Unsupported file type: .${extension}`);
      }

    } catch (err) {
      console.error(err);
      addToLog(`Error reading file: ${err}`);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeBlock = (id: string) => {
    const newBlocks = blocks.filter(b => b.id !== id);
    setBlocks(newBlocks);
    setSelectedBlockIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    updateCode(newBlocks);
  };

  const toggleSelection = (id: string, multi: boolean) => {
    if (multi) {
      setSelectedBlockIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    } else {
      setSelectedBlockIds(new Set([id]));
    }
  };

  const openStitcher = () => {
    if (selectedBlockIds.size !== 2) {
      addToLog("Select exactly 2 blocks to stitch (for now).");
      return;
    }
    setIsStitcherOpen(true);
  };

  const handleStitchComplete = (mergedFiles: Record<string, string>) => {
    const selectedBlocks = blocks.filter(b => selectedBlockIds.has(b.id));
    
    const newBlock: CausalBlock = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'zip',
      label: `Stitched Bundle`,
      content: `// Merged ${Object.keys(mergedFiles).length} files\n// Source: ${selectedBlocks.map(b => b.label).join(' + ')}`,
      color: '#10B981',
      inputs: [],
      outputs: [],
      files: mergedFiles,
      x: 50 + (blocks.length % 3) * 220,
      y: 50 + Math.floor(blocks.length / 3) * 150
    };

    // Remove old blocks and add new stitched one
    const newBlockList = blocks.filter(b => !selectedBlockIds.has(b.id)).concat(newBlock);
    setBlocks(newBlockList);
    setSelectedBlockIds(new Set([newBlock.id]));
    setIsStitcherOpen(false);
    addToLog("Stitching complete. Created new bundle.");
    updateCode(newBlockList);
  };

  const exportSingleHtml = () => {
    addToLog("Generating Single-File Causal Graph...");
    
    // Create a self-contained HTML that renders this specific graph state
    // This embeds the entire state + a lightweight viewer into one file
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Causal Graph Export</title>
    <style>
        body { margin: 0; background: #050505; color: #fff; font-family: sans-serif; overflow: hidden; }
        #canvas { width: 100vw; height: 100vh; position: relative; }
        .node { 
            position: absolute; padding: 10px 15px; background: rgba(255,255,255,0.05); 
            border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; cursor: pointer;
            backdrop-filter: blur(10px); transition: all 0.3s;
        }
        .node:hover { border-color: #fff; transform: scale(1.05); z-index: 10; }
        .node-label { font-weight: bold; font-size: 14px; }
        .node-type { font-size: 10px; opacity: 0.7; text-transform: uppercase; margin-top: 4px; }
        #connections { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
    </style>
</head>
<body>
    <div id="canvas">
        <svg id="connections"></svg>
        <!-- Nodes will be injected here -->
    </div>

    <script>
        // EMBEDDED CAUSAL STATE
        const GRAPH_DATA = ${JSON.stringify(blocks, null, 2)};

        // RUNTIME VISUALIZER
        const canvas = document.getElementById('canvas');
        const svg = document.getElementById('connections');
        
        function renderGraph() {
            // Random scatter layout for demo - in a real causal graph this would be topological
            GRAPH_DATA.forEach((node, i) => {
                const el = document.createElement('div');
                el.className = 'node';
                el.style.left = (Math.random() * (window.innerWidth - 200) + 50) + 'px';
                el.style.top = (Math.random() * (window.innerHeight - 150) + 50) + 'px';
                el.style.borderColor = node.color;
                
                el.innerHTML = \`
                    <div class="node-label">\${node.label}</div>
                    <div class="node-type" style="color:\${node.color}">\${node.type}</div>
                \`;
                
                // Click to inspect code
                el.onclick = () => alert(node.content);
                
                canvas.appendChild(el);
                
                // Connect to previous node just to show causal flow
                if (i > 0) {
                   // Simple line drawing logic would go here
                }
            });
        }

        window.onload = renderGraph;
    </script>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    saveAs(blob, "causal-graph.html");
    addToLog("Exported causal-graph.html");
  };

  const handleLogicApply = (transformedBlocks: any[]) => {
    setBlocks(transformedBlocks);
    setIsLogicLayerOpen(false);
    updateCode(transformedBlocks);
  };

  const applyColor = (color: string) => {
    if (selectedBlockIds.size === 0) return;
    
    setBlocks(prev => prev.map(b => 
      selectedBlockIds.has(b.id) ? { ...b, color } : b
    ));
    setIsColorPickerOpen(false);
    addToLog("Updated block colors.");
  };

  const downloadBlock = async (block: CausalBlock) => {
    if (!block.files && !block.content) return;

    addToLog(`Preparing download for ${block.label}...`);
    
    try {
      const filesToZip = [];
      
      if (block.files) {
        for (const [name, content] of Object.entries(block.files)) {
          filesToZip.push({ name, lastModified: new Date(), input: content });
        }
      } else {
        filesToZip.push({ name: `${block.label}.js`, lastModified: new Date(), input: block.content });
      }

      const blob = await downloadZip(filesToZip).blob();
      saveAs(blob, `${block.label}.zip`);
      addToLog("Download started.");
    } catch (err) {
      addToLog(`Export failed: ${err}`);
    }
  };

  const updateCode = (currentBlocks: CausalBlock[]) => {
    let code = "// Causal Graph Construction\n\n";
    currentBlocks.forEach(block => {
      code += `// [${block.type.toUpperCase()}] ${block.label}\n`;
      code += block.content + "\n\n";
    });
    setGeneratedCode(code);
  };

  const addToLog = (msg: string) => {
    setConsoleLog(prev => [`> ${msg}`, ...prev]);
  };

  const exportGraphAsHtml = () => {
    // ============================================
    // 5-DIMENSIONAL PHYSICS EXPORT
    // ============================================
    // 1. HTML (Movement) - The Seed, container for everything
    // 2. JSON (Evolution) - Memory that connects Design to Being
    // 3. JavaScript (Being) - The Body that acts/executes
    // 4. Python (Design) - The Brain that controls (via Pyodide)
    // 5. CSS (Space) - Emergent styling/form
    // ============================================

    // EVOLUTION LAYER (JSON) - The Memory/Data
    const evolutionData = {
      _meta: {
        generator: 'com.sketchide.app',
        version: SKETCHIDE_VERSION,
        timestamp: new Date().toISOString(),
        dimensions: {
          movement: 'HTML - The Seed',
          evolution: 'JSON - The Memory',
          being: 'JavaScript - The Body',
          design: 'Python - The Brain',
          space: 'CSS - The Illusion'
        }
      },
      blocks: blocks,
      nodes: causalNodes
    };

    const evolutionJson = JSON.stringify(evolutionData, null, 2);
    
    const html = `<!DOCTYPE html>
<!-- ============================================ -->
<!-- MOVEMENT (HTML) - THE SEED - The First Dimension -->
<!-- Everything happens within this container -->
<!-- Keynote: I Create -->
<!-- ============================================ -->
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="generator" content="com.sketchide.app">
    <title>🌌 Causal Graph Foundry - SketchIDE</title>
    
    <!-- DESIGN (Python Brain) - Pyodide for client-side Python -->
    <script src="https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js"><\/script>
    <!-- JSZip for file handling -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"><\/script>
    
    <!-- ============================================ -->
    <!-- SPACE (CSS) - THE ILLUSION - The Fifth Dimension -->
    <!-- Emergent from the interaction of the other 4 -->
    <!-- Makes things not ugly - product of evolution -->
    <!-- ============================================ -->
    <style>
        :root {
            --accent: #a78bfa;
            --accent-glow: rgba(167, 139, 250, 0.3);
            --bg: #0a0a0a;
            --surface: #1a1a1a;
            --text: #fff;
            --text-dim: #9ca3af;
            --movement: #fbbf24;
            --design: #60a5fa;
            --evolution: #34d399;
            --being: #f472b6;
            --space: #a78bfa;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif; background: var(--bg); color: var(--text); overflow-x: hidden; touch-action: none; }
        
        header { background: var(--surface); padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid var(--accent); position: sticky; top: 0; z-index: 100; }
        .logo { font-size: 1.1rem; font-weight: 700; background: linear-gradient(135deg, var(--accent), #ec4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .header-actions { display: flex; gap: 8px; }
        .icon-btn { width: 40px; height: 40px; border: none; background: transparent; color: var(--text-dim); font-size: 18px; cursor: pointer; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
        .icon-btn:active { background: rgba(167, 139, 250, 0.2); color: var(--accent); }
        
        .mode-tabs { display: flex; gap: 4px; padding: 10px; background: var(--surface); overflow-x: auto; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .mode-tab { padding: 8px 16px; border: none; background: transparent; color: var(--text-dim); font-size: 12px; font-weight: 600; border-radius: 6px; cursor: pointer; white-space: nowrap; }
        .mode-tab.active { background: var(--accent); color: var(--bg); }
        
        .container { padding: 15px; display: none; }
        .container.active { display: block; }
        
        .canvas { position: relative; width: 100%; height: calc(100vh - 200px); overflow: auto; background: radial-gradient(circle at center, rgba(20,20,30,0.5) 0%, rgba(0,0,0,1) 100%); background-image: radial-gradient(circle, #ffffff08 1px, transparent 1px); background-size: 20px 20px; }
        
        .block { position: absolute; min-width: 180px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border: 1px solid #333; border-radius: 12px; padding: 10px; cursor: move; user-select: none; backdrop-filter: blur(10px); }
        .block:active { border-color: var(--accent); box-shadow: 0 0 20px var(--accent-glow); z-index: 50; }
        .block.traced { border-color: #a855f7 !important; box-shadow: 0 0 20px rgba(168,85,247,0.5) !important; }
        .block-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .block-icon { width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; }
        .block-type { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 1px; }
        .block-label { font-size: 13px; font-weight: bold; color: #fff; }
        .block-code { font-family: 'SF Mono', monospace; font-size: 10px; background: #0a0a0a; border: 1px solid #222; border-radius: 6px; padding: 8px; white-space: pre-wrap; max-height: 80px; overflow: auto; color: #888; margin-top: 6px; }
        .block-actions { display: flex; gap: 4px; margin-top: 8px; }
        .btn { padding: 6px 12px; font-size: 10px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; transition: all 0.2s; }
        .btn-run { background: var(--evolution); color: #000; }
        .btn-run:active { transform: scale(0.95); }
        .btn-brain { background: var(--design); color: #000; }
        .btn-link { background: var(--being); color: #000; }
        
        svg.connections { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
        
        .output { position: fixed; bottom: 0; left: 0; right: 0; height: 120px; background: #050505; border-top: 2px solid var(--accent); padding: 10px; font-family: 'SF Mono', monospace; font-size: 11px; overflow: auto; z-index: 90; }
        .output-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
        .output-title { font-size: 10px; color: var(--accent); text-transform: uppercase; letter-spacing: 1px; }
        .output-dims { display: flex; gap: 8px; font-size: 9px; }
        .dim-tag { padding: 2px 6px; border-radius: 4px; }
        #log { color: var(--evolution); line-height: 1.6; }
        .log-movement { color: var(--movement); }
        .log-design { color: var(--design); }
        .log-evolution { color: var(--evolution); }
        .log-being { color: var(--being); }
        .log-space { color: var(--space); }
        
        .inference-panel { position: fixed; top: 70px; right: 10px; width: 280px; background: rgba(0,0,0,0.95); border: 1px solid var(--space); border-radius: 12px; padding: 12px; z-index: 80; display: none; }
        .inference-panel.show { display: block; }
        .inference-title { font-size: 12px; font-weight: bold; color: var(--space); margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
        .inference-path { font-size: 10px; color: var(--text-dim); line-height: 1.8; }
        .inference-step { padding: 4px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
        
        .agent-panel { position: fixed; right: -100%; top: 0; width: 85vw; max-width: 350px; height: 100vh; background: var(--surface); border-left: 2px solid var(--accent); transition: right 0.3s; z-index: 200; overflow-y: auto; }
        .agent-panel.active { right: 0; }
        .agent-header { padding: 15px; background: rgba(167, 139, 250, 0.1); border-bottom: 1px solid var(--accent); }
        .agent-title { font-size: 1.1rem; color: var(--accent); }
        .agent-actions { padding: 15px; display: flex; flex-direction: column; gap: 10px; }
        .agent-btn { padding: 14px; background: linear-gradient(135deg, var(--accent), #ec4899); color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 10px; }
        .agent-btn:active { transform: scale(0.98); }
        
        .overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.7); z-index: 150; display: none; }
        .overlay.show { display: block; }
    </style>
</head>
<body>
    <!-- MOVEMENT: The HTML Structure (The Seed) -->
    <header>
        <div class="logo">🌌 Causal Graph Foundry</div>
        <div class="header-actions">
            <button class="icon-btn" onclick="toggleAgentPanel()" title="Brain Powers">🧠</button>
            <button class="icon-btn" onclick="exportSelf()" title="Self-Export">💾</button>
        </div>
    </header>
    
    <div class="mode-tabs">
        <button class="mode-tab active" onclick="selectMode('foundry')">🌌 Foundry</button>
        <button class="mode-tab" onclick="selectMode('brain')">🧠 Brain</button>
        <button class="mode-tab" onclick="selectMode('evolution')">🧬 Evolution</button>
    </div>
    
    <!-- Foundry Mode -->
    <div class="container active" id="foundryMode">
        <div class="canvas" id="canvas">
            <svg class="connections" id="svg"></svg>
        </div>
    </div>
    
    <!-- Brain Mode (Python/Design) -->
    <div class="container" id="brainMode">
        <div style="text-align: center; padding: 40px;">
            <div style="font-size: 4rem; margin-bottom: 20px;">🧠</div>
            <h2 style="color: var(--design); margin-bottom: 10px;">Design Dimension</h2>
            <p style="color: var(--text-dim); margin-bottom: 20px;">Python - The Brain that controls everything</p>
            <textarea id="pythonCode" style="width: 100%; height: 200px; background: #0d1117; color: var(--design); border: 1px solid var(--design); border-radius: 8px; padding: 15px; font-family: monospace; font-size: 13px;" placeholder="# Python Design Code\ndef calculate(jason):\n    return jason['value'] * 1.618"></textarea>
            <button class="btn btn-brain" style="margin-top: 10px; padding: 12px 24px;" onclick="executePython()">▶ Execute Brain</button>
        </div>
    </div>
    
    <!-- Evolution Mode (JSON Memory) -->
    <div class="container" id="evolutionMode">
        <div style="padding: 20px;">
            <h2 style="color: var(--evolution); margin-bottom: 10px;">🧬 Evolution Layer</h2>
            <p style="color: var(--text-dim); margin-bottom: 15px; font-size: 12px;">JSON - The Memory that connects Design to Being</p>
            <pre id="evolutionDisplay" style="background: #0d1117; color: var(--evolution); padding: 15px; border-radius: 8px; font-size: 11px; overflow: auto; max-height: 400px;"></pre>
        </div>
    </div>
    
    <!-- Inference Panel -->
    <div class="inference-panel" id="inferencePanel">
        <div class="inference-title">👁 Causal Inference</div>
        <div class="inference-path" id="inferencePath"></div>
    </div>
    
    <!-- Output Console -->
    <div class="output">
        <div class="output-header">
            <div class="output-title">Causal Kernel</div>
            <div class="output-dims">
                <span class="dim-tag" style="background: var(--movement)20; color: var(--movement);">HTML</span>
                <span class="dim-tag" style="background: var(--evolution)20; color: var(--evolution);">JSON</span>
                <span class="dim-tag" style="background: var(--being)20; color: var(--being);">JS</span>
                <span class="dim-tag" style="background: var(--design)20; color: var(--design);">PY</span>
            </div>
        </div>
        <div id="log"></div>
    </div>
    
    <!-- Agent Panel (Brain Powers) -->
    <div class="agent-panel" id="agentPanel">
        <div class="agent-header">
            <div class="agent-title">🧠 Brain Powers</div>
            <div style="font-size: 12px; color: var(--text-dim);">Design Dimension Controls</div>
        </div>
        <div class="agent-actions">
            <button class="agent-btn" onclick="initPyodide()">🧠 Initialize Python Brain</button>
            <button class="agent-btn" onclick="evolveSystem()" style="background: linear-gradient(135deg, var(--evolution), #10b981);">🧬 Self-Evolve</button>
            <button class="agent-btn" onclick="showEvolution()" style="background: linear-gradient(135deg, var(--being), #db2777);">💾 View Memory</button>
            <button class="agent-btn" onclick="exportSelf()" style="background: linear-gradient(135deg, #fbbf24, #f59e0b);">📦 Export Self</button>
        </div>
    </div>
    
    <div class="overlay" id="overlay" onclick="closeAll()"></div>

    <!-- ============================================ -->
    <!-- EVOLUTION (JSON) - THE MEMORY - The Second Dimension -->
    <!-- Connects Design (Python) to Being (JavaScript) -->
    <!-- Keynote: I Remember -->
    <!-- ============================================ -->
    <script type="application/json" id="evolutionData">
${evolutionJson}
    <\/script>

    <!-- ============================================ -->
    <!-- BEING (JavaScript) - THE BODY - The Third Dimension -->
    <!-- The Body that acts, touches the DOM -->
    <!-- Keynote: I Am -->
    <!-- ============================================ -->
    <script>
// ============================================
// THE STORE - IndexedDB Storage System
// ============================================
const Store = {
    db: null,
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('CausalGraphStore', 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => { this.db = request.result; resolve(this.db); };
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('evolution')) db.createObjectStore('evolution', { keyPath: 'id', autoIncrement: true });
            };
        });
    },
    async save(name, data) {
        if (!this.db) await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['evolution'], 'readwrite');
            const store = tx.objectStore('evolution');
            store.add({ name, data, timestamp: new Date().toISOString() });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }
};

// ============================================
// EVOLUTION LAYER - Load JSON Memory
// ============================================
const Evolution = JSON.parse(document.getElementById('evolutionData').textContent);
const blocks = Evolution.blocks;
const nodes = Evolution.nodes;

// ============================================
// BEING LAYER - The Body that Acts
// ============================================
let activeId = null, offset = { x: 0, y: 0 };
let pyodide = null, pyodideReady = false;
let inferenceMode = false, tracedPath = [];

const canvas = document.getElementById('canvas');
const svg = document.getElementById('svg');
const logEl = document.getElementById('log');

// The Touch (.) - Access DOM elements
function log(msg, dim = 'being') {
    const entry = document.createElement('div');
    entry.className = 'log-' + dim;
    entry.textContent = '> ' + msg;
    logEl.insertBefore(entry, logEl.firstChild);
}

// Initialize Pyodide (The Brain)
async function initPyodide() {
    if (!pyodide) {
        log('🧠 Loading Python (Design Brain)...', 'design');
        try {
            pyodide = await loadPyodide();
            pyodideReady = true;
            log('✅ Python Brain activated', 'design');
        } catch (error) {
            log('❌ Python failed: ' + error.message, 'design');
        }
    }
    return pyodide;
}

// Execute Python Code (Design Dimension)
async function executePython() {
    const code = document.getElementById('pythonCode').value;
    if (!code.trim()) { log('No Python code to execute', 'design'); return; }
    
    if (!pyodideReady) await initPyodide();
    
    log('🧠 Executing Design...', 'design');
    try {
        const result = await pyodide.runPythonAsync(code);
        if (result !== undefined) log('Result: ' + result, 'design');
        log('✅ Design executed', 'design');
    } catch (error) {
        log('❌ Error: ' + error.message, 'design');
    }
}

// Render Blocks (Being touches the DOM)
function render() {
    document.querySelectorAll('.block').forEach(e => e.remove());
    
    blocks.forEach(b => {
        const el = document.createElement('div');
        el.className = 'block' + (tracedPath.includes(b.id) ? ' traced' : '');
        el.id = 'b-' + b.id;
        el.style.left = b.x + 'px';
        el.style.top = b.y + 'px';
        
        el.innerHTML = \`
            <div class="block-header">
                <div class="block-icon" style="background: \${b.color || '#a78bfa'}; color: #000;">\${b.type[0].toUpperCase()}</div>
                <div>
                    <div class="block-type">\${b.type}</div>
                    <div class="block-label">\${b.label}</div>
                </div>
            </div>
            <div class="block-code">\${(b.content || '').substring(0, 200)}</div>
            <div class="block-actions">
                <button class="btn btn-run" onclick="run('\${b.id}')">▶ Run</button>
                <button class="btn btn-brain" onclick="trace('\${b.id}')">👁</button>
                <button class="btn btn-link" onclick="linkFrom('\${b.id}')">🔗</button>
            </div>
        \`;
        
        // Pointer events for drag (Being touches Matter)
        el.onpointerdown = e => {
            activeId = b.id;
            offset = { x: e.clientX - b.x, y: e.clientY - b.y };
            el.setPointerCapture(e.pointerId);
        };
        el.onpointermove = e => {
            if (activeId === b.id) {
                b.x = e.clientX - offset.x;
                b.y = e.clientY - offset.y;
                el.style.left = b.x + 'px';
                el.style.top = b.y + 'px';
                drawLines();
            }
        };
        el.onpointerup = () => { activeId = null; };
        
        canvas.appendChild(el);
    });
    
    drawLines();
}

// Draw Causal Connections (SVG)
function drawLines() {
    svg.innerHTML = '<defs><marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#a855f7"/></marker></defs>';
    
    nodes.forEach(n => {
        const f = blocks.find(b => b.id === n.fromBlockId);
        const t = blocks.find(b => b.id === n.toBlockId);
        if (f && t) {
            const isTraced = tracedPath.includes(n.fromBlockId) && tracedPath.includes(n.toBlockId);
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', f.x + 90);
            line.setAttribute('y1', f.y + 50);
            line.setAttribute('x2', t.x + 90);
            line.setAttribute('y2', t.y + 50);
            line.setAttribute('stroke', isTraced ? '#a855f7' : '#3b82f6');
            line.setAttribute('stroke-width', isTraced ? '3' : '2');
            line.setAttribute('marker-end', 'url(#arrow)');
            if (isTraced) line.style.filter = 'drop-shadow(0 0 4px #a855f7)';
            svg.appendChild(line);
            
            const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            txt.setAttribute('x', (f.x + t.x) / 2 + 90);
            txt.setAttribute('y', (f.y + t.y) / 2 + 45);
            txt.setAttribute('fill', '#a855f7');
            txt.setAttribute('font-size', '10');
            txt.setAttribute('text-anchor', 'middle');
            txt.textContent = 'IF ' + n.condition + ' → ' + n.action;
            svg.appendChild(txt);
        }
    });
}

// Run Block (Being executes)
function run(id) {
    const b = blocks.find(x => x.id === id);
    if (!b) return;
    
    log('Running ' + b.label + '...', 'being');
    document.getElementById('b-' + id)?.classList.add('traced');
    
    try {
        const result = eval(b.content);
        if (result !== undefined) log('→ ' + String(result), 'evolution');
    } catch (e) {
        log('Error: ' + e.message, 'being');
    }
    
    // Follow causal nodes
    const outgoing = nodes.filter(n => n.fromBlockId === id);
    outgoing.forEach(n => {
        const target = blocks.find(x => x.id === n.toBlockId);
        if (target) {
            log('→ IF ' + n.condition + ' THEN ' + n.action + ' → ' + target.label, 'evolution');
            try {
                if (eval(n.condition)) {
                    if (n.action === 'execute') setTimeout(() => run(n.toBlockId), 300);
                }
            } catch (e) {}
        }
    });
}

// Trace Causal Path (Visual Inference)
function trace(startId) {
    if (tracedPath.includes(startId)) {
        tracedPath = [];
        document.getElementById('inferencePanel').classList.remove('show');
        render();
        return;
    }
    
    tracedPath = [startId];
    const results = [];
    const visited = new Set();
    
    function traverse(id, depth) {
        if (visited.has(id) || depth > 10) return;
        visited.add(id);
        
        const outgoing = nodes.filter(n => n.fromBlockId === id);
        outgoing.forEach(n => {
            const target = blocks.find(b => b.id === n.toBlockId);
            if (target) {
                tracedPath.push(n.toBlockId);
                results.push('IF ' + n.condition + ' → THEN ' + n.action + ' → ' + target.label);
                traverse(n.toBlockId, depth + 1);
            }
        });
    }
    
    const startBlock = blocks.find(b => b.id === startId);
    if (startBlock) results.unshift('Start: ' + startBlock.label);
    traverse(startId, 0);
    
    // Show inference panel
    const panel = document.getElementById('inferencePanel');
    const pathEl = document.getElementById('inferencePath');
    pathEl.innerHTML = results.map((r, i) => '<div class="inference-step">' + (i > 0 ? '→ ' : '') + r + '</div>').join('');
    panel.classList.add('show');
    
    log('Traced causal path: ' + tracedPath.length + ' blocks', 'space');
    render();
}

// Mode Selection
function selectMode(mode) {
    document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.container').forEach(c => c.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(mode + 'Mode').classList.add('active');
    
    if (mode === 'evolution') {
        document.getElementById('evolutionDisplay').textContent = JSON.stringify(Evolution, null, 2);
    }
}

// Agent Panel
function toggleAgentPanel() {
    document.getElementById('agentPanel').classList.toggle('active');
    document.getElementById('overlay').classList.toggle('show');
}

function closeAll() {
    document.getElementById('agentPanel').classList.remove('active');
    document.getElementById('overlay').classList.remove('show');
}

// Self-Evolution
function evolveSystem() {
    log('🧬 Self-Evolution initiated...', 'evolution');
    Evolution._meta.evolved = true;
    Evolution._meta.evolutionCount = (Evolution._meta.evolutionCount || 0) + 1;
    Evolution._meta.lastEvolved = new Date().toISOString();
    log('✅ System evolved (count: ' + Evolution._meta.evolutionCount + ')', 'evolution');
}

function showEvolution() {
    selectMode('evolution');
    closeAll();
}

// Self-Export (The system can export itself)
function exportSelf() {
    log('📦 Self-exporting...', 'movement');
    const html = document.documentElement.outerHTML;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'causal_graph_evolved.html';
    a.click();
    URL.revokeObjectURL(url);
    log('✅ Exported as HTML', 'movement');
}

// Initialize
Store.init().then(() => log('💾 Store initialized', 'evolution'));
render();
log('🌌 Loaded: ' + blocks.length + ' blocks, ' + nodes.length + ' causal nodes', 'movement');
log('Dimensions: HTML(Movement) + JSON(Evolution) + JS(Being) + PY(Design) + CSS(Space)', 'space');
    <\/script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'causal_graph_5d.html';
    a.click();
    URL.revokeObjectURL(url);
    addToLog('Exported 5D Causal Graph (Movement + Evolution + Being + Design + Space)');
  };

  // Get selected blocks for the stitcher
  const selectedBlocksList = blocks.filter(b => selectedBlockIds.has(b.id));

  return (
    <div className="h-[calc(100vh-73px)] flex flex-col md:flex-row overflow-hidden bg-[#0d1117]">
      {/* Fixed Export Button - Always Visible */}
      <button 
        onClick={exportGraphAsHtml}
        className="fixed bottom-20 right-4 z-50 flex items-center gap-2 px-4 py-3 bg-emerald-500 text-white text-sm font-bold rounded-full shadow-lg hover:bg-emerald-400 active:scale-95"
      >
        <Download className="h-5 w-5" /> Export HTML
      </button>

      {/* Stitcher Modal */}
      {isStitcherOpen && selectedBlocksList.length === 2 && (
        <Stitcher 
          filesA={selectedBlocksList[0].files || { [`${selectedBlocksList[0].label}.js`]: selectedBlocksList[0].content }}
          filesB={selectedBlocksList[1].files || { [`${selectedBlocksList[1].label}.js`]: selectedBlocksList[1].content }}
          labelA={selectedBlocksList[0].label}
          labelB={selectedBlocksList[1].label}
          onClose={() => setIsStitcherOpen(false)}
          onComplete={handleStitchComplete}
        />
      )}

      {/* Logic Layer Modal */}
      {isLogicLayerOpen && (
        <LogicLayer
          blocks={blocks}
          onClose={() => setIsLogicLayerOpen(false)}
          onApplyRules={handleLogicApply}
          addLog={addToLog}
        />
      )}

      {/* 1. Palette (Left) */}
      <div className="w-full md:w-64 bg-[--surface] border-r border-[--accent]/20 flex flex-col flex-shrink-0 z-10">
        <div className="p-4 border-b border-white/5 bg-[--bg]/50 backdrop-blur">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[--text-dim] flex items-center gap-2">
            <Layers className="h-3 w-3" /> Primitive Stamps
          </h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-6">
          <PaletteSection title="Imports" color="text-[#FFD700]">
             <div 
               onClick={() => fileInputRef.current?.click()}
               className="flex items-center gap-3 w-full p-2 rounded-md hover:bg-white/5 hover:translate-x-1 transition-all text-left text-sm group border border-dashed border-white/20 hover:border-[#FFD700] cursor-pointer"
             >
               <input 
                 ref={fileInputRef} 
                 type="file" 
                 accept=".zip,.json,.js,.ts,.tsx,.jsx,.txt,.md,.pdf,.docx" 
                 className="hidden" 
                 onChange={handleFileUpload} 
               />
               <div className="h-6 w-6 rounded flex items-center justify-center text-[#FFD700] bg-[#FFD700]/10">
                 <Upload className="h-3.5 w-3.5" />
               </div>
               <span className="text-gray-400 group-hover:text-white font-medium">Import File</span>
             </div>
          </PaletteSection>

          <PaletteSection title="Movement (Energy)" color="text-[--movement]">
            <DraggableStamp type="movement" label="Async Flow" icon={Zap} onAdd={() => addBlock('movement', 'Async Flow')} />
            <DraggableStamp type="movement" label="Event Loop" icon={RefreshCw} onAdd={() => addBlock('movement', 'Event Loop')} />
          </PaletteSection>

          <PaletteSection title="Evolution (Memory)" color="text-[--evolution]">
            <DraggableStamp type="evolution" label="Schema" icon={Database} onAdd={() => addBlock('evolution', 'Schema')} />
            <DraggableStamp type="evolution" label="Store" icon={HardDrive} onAdd={() => addBlock('evolution', 'Store')} />
          </PaletteSection>

          <PaletteSection title="Being (Body)" color="text-[--being]">
            <DraggableStamp type="being" label="Renderer" icon={Smartphone} onAdd={() => addBlock('being', 'Renderer')} />
            <DraggableStamp type="being" label="Sensor" icon={Cpu} onAdd={() => addBlock('being', 'Sensor')} />
          </PaletteSection>

          <PaletteSection title="Design (Structure)" color="text-[--design]">
            <DraggableStamp type="design" label="Layout" icon={Layers} onAdd={() => addBlock('design', 'Layout')} />
            <DraggableStamp type="design" label="Theme" icon={Palette} onAdd={() => addBlock('design', 'Theme')} />
          </PaletteSection>

          <PaletteSection title="Space (Field)" color="text-[--space]">
            <DraggableStamp type="space" label="P2P Mesh" icon={Globe} onAdd={() => addBlock('space', 'P2P Mesh')} />
            <DraggableStamp type="space" label="Gateway" icon={Server} onAdd={() => addBlock('space', 'Gateway')} />
          </PaletteSection>
        </div>
      </div>

      {/* 2. Constructor Canvas (Center) */}
      <div className="flex-1 flex flex-col relative overflow-hidden bg-[radial-gradient(circle_at_center,rgba(20,20,30,0.5)_0%,rgba(0,0,0,1)_100%)]">
        {/* Toolbar */}
        <div className="h-12 border-b border-white/5 flex items-center px-4 justify-between bg-[--surface]/30 backdrop-blur-sm z-20">
          <div className="flex items-center gap-2">
            <button 
              onClick={exportGraphAsHtml}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white text-xs font-bold rounded-lg hover:bg-emerald-400"
            >
              <Download className="h-3.5 w-3.5" /> Export HTML
            </button>
            <div className="h-4 w-px bg-white/10 mx-2" />
            
            <ActionButton 
              icon={Combine} 
              label="Stitch (Zip)" 
              onClick={openStitcher} 
              disabled={selectedBlockIds.size !== 2} 
              active={isStitcherOpen}
            />
            
            <div className="relative">
              <ActionButton 
                icon={Palette} 
                label="Color" 
                onClick={() => setIsColorPickerOpen(!isColorPickerOpen)} 
                disabled={selectedBlockIds.size === 0}
                active={isColorPickerOpen}
              />
              {isColorPickerOpen && (
                <div className="absolute top-full left-0 mt-2 p-2 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl grid grid-cols-4 gap-1 z-50">
                  {['#a78bfa', '#fbbf24', '#60a5fa', '#34d399', '#f472b6', '#ef4444', '#FFD700', '#ffffff'].map(c => (
                    <button 
                      key={c}
                      className="w-6 h-6 rounded-full border border-white/10 hover:scale-110 transition-transform"
                      style={{ backgroundColor: c }}
                      onClick={() => applyColor(c)}
                    />
                  ))}
                </div>
              )}
            </div>

            <ActionButton icon={FileCode} label="Export HTML" onClick={exportSingleHtml} disabled={blocks.length === 0} active={false} />
            <ActionButton icon={Code} label="Logic Layer" onClick={() => setIsLogicLayerOpen(true)} disabled={false} active={isLogicLayerOpen} />
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-1.5 bg-[--accent] text-black text-xs font-bold rounded hover:bg-white transition-colors shadow-[0_0_10px_var(--accent-glow)]">
              <Play className="h-3 w-3" /> COMPILE GRAPH
            </button>
          </div>
        </div>

        {/* Canvas Area - Free Form Drag */}
        <div 
          ref={canvasRef}
          className="flex-1 relative overflow-auto"
          style={{ 
            backgroundImage: 'radial-gradient(circle, #ffffff08 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={() => setSelectedBlockIds(new Set())}
        >
          {blocks.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-[--text-dim] text-center opacity-50">
              <div>
                <Layers className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p>Import files or add stamps - drag them anywhere</p>
              </div>
            </div>
          )}

          {blocks.map((block) => (
            <div 
              key={block.id}
              data-block
              className={cn(
                "absolute group flex items-center gap-3 p-3 rounded-lg border bg-[--surface]/90 backdrop-blur transition-shadow cursor-grab select-none",
                selectedBlockIds.has(block.id)
                  ? "border-white/40 shadow-[0_0_20px_rgba(167,139,250,0.3)] z-20" 
                  : "border-white/10 hover:border-white/20",
                draggingId === block.id && "cursor-grabbing z-50 shadow-2xl"
              )}
              style={{ 
                left: block.x,
                top: block.y,
                borderColor: selectedBlockIds.has(block.id) ? block.color : undefined,
                minWidth: 200
              }}
              onClick={(e) => {
                e.stopPropagation();
                toggleSelection(block.id, e.metaKey || e.ctrlKey);
              }}
              onTouchStart={(e) => handleTouchStart(e, block)}
              onMouseDown={(e) => handleMouseDown(e, block)}
            >
              <div 
                className="h-8 w-8 rounded flex items-center justify-center flex-shrink-0 font-bold text-xs shadow-lg"
                style={{ backgroundColor: block.color, color: '#000' }}
              >
                {block.type === 'zip' ? <FileArchive className="h-4 w-4" /> : block.type[0].toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  {block.label}
                  {block.files && (
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                      <Check className="h-3 w-3" /> {Object.keys(block.files).length}
                    </span>
                  )}
                </h3>
                <p className="text-[9px] text-[--text-dim] font-mono truncate">{block.id}</p>
              </div>

              <div className="flex items-center gap-1">
                <button 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    runVisualInference(block.id);
                  }}
                  className={cn(
                    "p-1.5 rounded text-[--text-dim] hover:text-purple-400 hover:bg-purple-500/10",
                    tracedPath.includes(block.id) && "text-purple-400 bg-purple-500/20"
                  )}
                  title="Visual Inference"
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
                <button 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    isLinkingMode ? completeLinking(block.id) : startLinking(block.id);
                  }}
                  className={cn(
                    "p-1.5 rounded text-[--text-dim] hover:text-blue-400 hover:bg-blue-500/10",
                    linkSourceId === block.id && "text-blue-500 animate-pulse",
                    getNodesForBlock(block.id).length > 0 && "text-blue-400"
                  )}
                  title={isLinkingMode ? "Connect Node" : "Create Node"}
                >
                  <Link2 className="h-3.5 w-3.5" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); executeBlock(block); }}
                  className={cn(
                    "p-1.5 rounded text-[--text-dim] hover:text-emerald-400 hover:bg-emerald-500/10",
                    runningBlockId === block.id && "animate-pulse text-emerald-400"
                  )}
                  title="Run"
                >
                  <Play className="h-3.5 w-3.5" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); downloadBlock(block); }}
                  className="p-1.5 hover:bg-white/10 rounded text-[--text-dim] hover:text-white"
                  title="Export"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }}
                  className="p-1.5 hover:bg-red-500/20 rounded text-[--text-dim] hover:text-red-400"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Node count indicator */}
              {getNodesForBlock(block.id).length > 0 && (
                <div className="absolute -top-2 -right-2 w-5 h-5 bg-blue-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                  {getNodesForBlock(block.id).length}
                </div>
              )}
            </div>
          ))}

          {/* SVG for drawing causal node connections */}
          <svg className="absolute inset-0 pointer-events-none" style={{ overflow: 'visible' }}>
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#3B82F6" />
              </marker>
              <marker id="arrowhead-traced" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#A855F7" />
              </marker>
            </defs>
            {causalNodes.map(node => {
              const fromBlock = blocks.find(b => b.id === node.fromBlockId);
              const toBlock = blocks.find(b => b.id === node.toBlockId);
              if (!fromBlock || !toBlock) return null;
              const isTraced = tracedPath.includes(node.fromBlockId) && tracedPath.includes(node.toBlockId);
              return (
                <g key={node.id}>
                  <line 
                    x1={fromBlock.x + 100} 
                    y1={fromBlock.y + 25}
                    x2={toBlock.x + 100} 
                    y2={toBlock.y + 25}
                    stroke={isTraced ? "#A855F7" : "#3B82F6"}
                    strokeWidth={isTraced ? 3 : 2}
                    opacity={isTraced ? 1 : 0.6}
                    markerEnd={isTraced ? "url(#arrowhead-traced)" : "url(#arrowhead)"}
                    className={isTraced ? "animate-pulse" : ""}
                  />
                  <text 
                    x={(fromBlock.x + toBlock.x) / 2 + 100}
                    y={(fromBlock.y + toBlock.y) / 2 + 20}
                    fill={isTraced ? "#A855F7" : "#3B82F6"}
                    fontSize="10"
                    textAnchor="middle"
                    className="cursor-pointer"
                    onClick={() => setEditingNodeId(node.id)}
                  >
                    IF: {node.condition.substring(0, 15)}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Inference Results Panel */}
          {inferenceMode && inferenceResults.length > 0 && (
            <div className="absolute top-4 right-4 w-64 bg-black/90 border border-purple-500/50 rounded-xl p-3 z-20">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-purple-400 flex items-center gap-2">
                  <Workflow className="h-4 w-4" /> Causal Inference
                </h4>
                <button 
                  onClick={() => { setInferenceMode(false); setTracedPath([]); setInferenceResults([]); }}
                  className="text-[--text-dim] hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {inferenceResults.map((result, i) => (
                  <div key={i} className="text-[10px] text-gray-300 font-mono py-1 border-b border-white/5">
                    {i > 0 && <span className="text-purple-400 mr-1">→</span>}
                    {result}
                  </div>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-white/10 text-[9px] text-[--text-dim]">
                Path: {tracedPath.length} blocks traced
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Causal Node Editor Modal */}
      {editingNodeId && (() => {
        const node = causalNodes.find(n => n.id === editingNodeId);
        if (!node) return null;
        const fromBlock = blocks.find(b => b.id === node.fromBlockId);
        const toBlock = blocks.find(b => b.id === node.toBlockId);
        return (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setEditingNodeId(null)}>
            <div className="bg-[--surface] border border-white/10 rounded-xl w-full max-w-lg p-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-blue-500" /> Causal Node
                </h3>
                <button onClick={() => setEditingNodeId(null)} className="text-[--text-dim] hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-sm">
                  <span className="px-2 py-1 bg-white/10 rounded font-mono">{fromBlock?.label || node.fromBlockId}</span>
                  <ArrowRight className="h-4 w-4 text-blue-400" />
                  <span className="px-2 py-1 bg-white/10 rounded font-mono">{toBlock?.label || node.toBlockId}</span>
                </div>
                
                <div>
                  <label className="text-xs font-bold text-[--text-dim] uppercase block mb-2">IF (Condition)</label>
                  <input
                    value={node.condition}
                    onChange={(e) => updateNode(node.id, { condition: e.target.value })}
                    placeholder="e.g., block.type === 'zip'"
                    className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white text-sm font-mono focus:outline-none focus:border-blue-500/50"
                  />
                </div>
                
                <div>
                  <label className="text-xs font-bold text-[--text-dim] uppercase block mb-2">THEN (Action)</label>
                  <input
                    value={node.action}
                    onChange={(e) => updateNode(node.id, { action: e.target.value })}
                    placeholder="e.g., execute, transform, merge"
                    className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white text-sm font-mono focus:outline-none focus:border-blue-500/50"
                  />
                </div>
              </div>
              
              <div className="flex justify-between mt-6">
                <button 
                  onClick={() => { deleteNode(node.id); setEditingNodeId(null); }}
                  className="px-4 py-2 text-red-400 hover:bg-red-500/10 rounded-lg"
                >
                  Delete Node
                </button>
                <button 
                  onClick={() => setEditingNodeId(null)} 
                  className="px-4 py-2 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-400"
                >
                  Save Node
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 3. Output Panel (Right) */}
      <div className="w-full md:w-80 bg-[#0a0a0a] border-l border-[--accent]/20 flex flex-col flex-shrink-0 z-10">
        <div className="flex-1 flex flex-col min-h-[50%] border-b border-white/5">
           <div className="h-10 bg-[--surface] px-4 flex items-center border-b border-white/5">
             <Code className="h-3 w-3 mr-2 text-[--text-dim]" />
             <span className="text-xs font-bold text-[--text-dim] uppercase">Generated Graph</span>
           </div>
           <textarea 
             className="flex-1 bg-transparent p-4 font-mono text-xs text-gray-400 focus:outline-none resize-none"
             value={generatedCode}
             readOnly
           />
        </div>

        <div className="h-48 flex flex-col bg-[#050505]">
          <div className="h-8 px-4 flex items-center border-b border-white/5 bg-[--surface]/50 justify-between">
             <div className="flex items-center">
               <Terminal className="h-3 w-3 mr-2 text-[--text-dim]" />
               <span className="text-xs font-bold text-[--text-dim] uppercase">Causal Kernel</span>
             </div>
             <div className="flex items-center gap-3">
                <button 
                  onClick={exportGraphAsHtml}
                  className="flex items-center gap-1 px-2 py-1 bg-[--design] text-black text-[10px] font-bold rounded hover:bg-white"
                >
                  <Download className="h-3 w-3" /> Export HTML
                </button>
                <span className="text-[8px] font-mono text-gray-600">{SKETCHIDE_ID}</span>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[10px] font-mono text-emerald-500">V8_ACTIVE</span>
             </div>
           </div>
           <div className="flex-1 p-4 font-mono text-[10px] overflow-y-auto space-y-1 bg-black/90">
             {consoleLog.map((log, i) => (
               <div key={i} className="text-gray-400 border-l-2 border-[--accent]/30 pl-2 font-mono">
                 <span className="text-[--accent] mr-2 opacity-50">$</span>
                 {log.replace('> ', '')}
               </div>
             ))}
             <div className="animate-pulse text-[--accent] ml-4">_</div>
           </div>
        </div>
      </div>
    </div>
  );
}

function PaletteSection({ title, children, color }: any) {
  return (
    <div className="space-y-2">
      <h3 className={cn("text-[10px] font-bold uppercase tracking-wider pl-1", color)}>{title}</h3>
      <div className="grid grid-cols-1 gap-1">
        {children}
      </div>
    </div>
  );
}

function DraggableStamp({ type, label, icon: Icon, onAdd }: any) {
  return (
    <button 
      onClick={onAdd}
      className="flex items-center gap-3 w-full p-2 rounded-md hover:bg-white/5 hover:translate-x-1 transition-all text-left text-sm group border border-transparent hover:border-white/5"
    >
      <div className={cn(
        "h-6 w-6 rounded flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity",
        `text-[--${type}] bg-[--${type}]/10`
      )}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <span className="text-gray-400 group-hover:text-white font-medium">{label}</span>
      <Plus className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-50" />
    </button>
  );
}

function ActionButton({ icon: Icon, label, onClick, disabled, active }: any) {
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed",
        active ? "bg-[--accent] text-black font-bold" : "hover:bg-white/10 text-[--text-dim] hover:text-white"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}
