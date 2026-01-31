
import React, { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { useAgentProcessor } from '../hooks/useAgentProcessor';
import { AgentCursor } from './AgentCursor';
import { DomOverlay } from './DomOverlay';

interface CanvasManagerProps {
  onCanvasReady: (canvas: any) => void;
}

export const CanvasManager: React.FC<CanvasManagerProps> = ({ onCanvasReady }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<any>(null);
  
  const addLog = useStore(state => state.addLog);
  const setViewport = useStore(state => state.setViewport);
  const setCursorPosition = useStore(state => state.setCursorPosition);
  const updateDomElement = useStore(state => state.updateDomElement);
  const removeDomElement = useStore(state => state.removeDomElement);
  
  const activeTool = useStore(state => state.activeTool);
  const brushColor = useStore(state => state.brushColor);
  const brushWidth = useStore(state => state.brushWidth);
  const setActiveTool = useStore(state => state.setActiveTool);

  useEffect(() => {
    if (!canvasRef.current || !window.fabric) return;

    // --- CUSTOM CONTROLS (DELETE BUTTON ON SELECTION) ---
    const deleteIcon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23ff003c' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 6h18'%3E%3C/path%3E%3Cpath d='M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6'%3E%3C/path%3E%3Cpath d='M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2'%3E%3C/path%3E%3Cline x1='10' y1='11' x2='10' y2='17'%3E%3C/line%3E%3Cline x1='14' y1='11' x2='14' y2='17'%3E%3C/line%3E%3C/svg%3E";
    const img = document.createElement('img');
    img.src = deleteIcon;

    function renderIcon(ctx: CanvasRenderingContext2D, left: number, top: number, styleOverride: any, fabricObject: any) {
      const size = 24;
      ctx.save();
      ctx.translate(left, top);
      ctx.rotate(window.fabric.util.degreesToRadians(fabricObject.angle));
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
      ctx.restore();
    }

    function deleteObject(eventData: any, transform: any) {
      const target = transform.target;
      const canvas = target.canvas;
      if (target.type === 'activeSelection') {
        target.forEachObject((obj: any) => {
          canvas.remove(obj);
          if (obj.isDomPlaceholder) removeDomElement(obj.id);
        });
        canvas.discardActiveObject();
      } else {
        canvas.remove(target);
        if (target.isDomPlaceholder) removeDomElement(target.id);
      }
      canvas.requestRenderAll();
      return true;
    }

    window.fabric.Object.prototype.controls.deleteControl = new window.fabric.Control({
      x: 0.5,
      y: -0.5,
      offsetY: -16,
      offsetX: 16,
      cursorStyle: 'pointer',
      mouseUpHandler: deleteObject,
      render: renderIcon,
      // @ts-ignore
      cornerSize: 24
    });

    const canvas = new window.fabric.Canvas(canvasRef.current, {
      backgroundColor: '#0a0a0f',
      selection: true,
      allowTouchScrolling: true,
      preserveObjectStacking: true,
      renderOnAddRemove: true,
      imageSmoothingEnabled: true,
      enableRetinaScaling: true,
      fireRightClick: true, // Enable right click for panning
      stopContextMenu: true, // Prevent browser menu on right click
    });

    fabricRef.current = canvas;
    setCursorPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

    const resizeCanvas = () => {
      if (!canvas) return;
      canvas.setWidth(window.innerWidth);
      canvas.setHeight(window.innerHeight);
      canvas.requestRenderAll();
      setViewport(canvas.getZoom(), canvas.viewportTransform || [1, 0, 0, 1, 0, 0]);
    };
    
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('orientationchange', resizeCanvas);
    resizeCanvas();

    // --- NAVIGATION LOGIC (PAN & ZOOM) ---
    let isPanning = false;
    let isSpaceDown = false;
    let lastPosX: number;
    let lastPosY: number;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) return;

      if (e.code === 'Space') {
        isSpaceDown = true;
        canvas.defaultCursor = 'grab';
        canvas.selection = false;
        canvas.requestRenderAll();
      }

      // Zoom Keyboard Shortcuts
      if (e.key === '=' || e.key === '+') {
        const zoom = Math.min(canvas.getZoom() * 1.1, 20);
        canvas.zoomToPoint({ x: canvas.width / 2, y: canvas.height / 2 }, zoom);
        setViewport(canvas.getZoom(), canvas.viewportTransform);
      }
      if (e.key === '-' || e.key === '_') {
        const zoom = Math.max(canvas.getZoom() / 1.1, 0.01);
        canvas.zoomToPoint({ x: canvas.width / 2, y: canvas.height / 2 }, zoom);
        setViewport(canvas.getZoom(), canvas.viewportTransform);
      }
      if (e.key === '0') {
        canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        canvas.setZoom(1);
        setViewport(1, [1, 0, 0, 1, 0, 0]);
      }

      // Deletion
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const activeObj = canvas.getActiveObject();
        if (activeObj && activeObj.isEditing) return;
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length > 0) {
          activeObjects.forEach((obj: any) => {
            canvas.remove(obj);
            if (obj.isDomPlaceholder) removeDomElement(obj.id);
          });
          canvas.discardActiveObject().requestRenderAll();
          addLog(`Deleted ${activeObjects.length} objects.`);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpaceDown = false;
        canvas.defaultCursor = 'default';
        if (useStore.getState().activeTool === 'SELECT') canvas.selection = true;
        canvas.requestRenderAll();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    canvas.on('mouse:down', function(opt: any) {
      const evt = opt.e;
      const isTouch = evt.touches && evt.touches.length === 1;
      const isRightClick = evt.button === 2;
      const isMiddleClick = evt.button === 1;
      
      // Pan triggers: Space+Drag, Right-click, Middle-click, or Touch-on-empty
      if (isSpaceDown || isRightClick || isMiddleClick || (isTouch && !opt.target)) {
        isPanning = true;
        canvas.selection = false;
        canvas.defaultCursor = 'grabbing';
        lastPosX = evt.clientX || (evt.touches && evt.touches[0].clientX);
        lastPosY = evt.clientY || (evt.touches && evt.touches[0].clientY);
        canvas.requestRenderAll();
      }
    });

    canvas.on('mouse:move', function(opt: any) {
      if (isPanning) {
        const e = opt.e;
        const currentX = e.clientX || (e.touches && e.touches[0].clientX);
        const currentY = e.clientY || (e.touches && e.touches[0].clientY);
        if (currentX === undefined || currentY === undefined) return;
        const vpt = canvas.viewportTransform;
        vpt[4] += currentX - lastPosX;
        vpt[5] += currentY - lastPosY;
        canvas.requestRenderAll();
        lastPosX = currentX;
        lastPosY = currentY;
        setViewport(canvas.getZoom(), vpt);
      }
    });

    canvas.on('mouse:up', function() {
      canvas.setViewportTransform(canvas.viewportTransform);
      isPanning = false;
      canvas.defaultCursor = isSpaceDown ? 'grab' : 'default';
      if (!isSpaceDown && useStore.getState().activeTool === 'SELECT') canvas.selection = true;
      canvas.requestRenderAll();
    });

    canvas.on('mouse:wheel', function(opt: any) {
      const delta = opt.e.deltaY;
      let zoom = canvas.getZoom();
      zoom *= 0.999 ** delta;
      if (zoom > 20) zoom = 20;
      if (zoom < 0.01) zoom = 0.01;
      canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
      opt.e.preventDefault();
      opt.e.stopPropagation();
      setViewport(canvas.getZoom(), canvas.viewportTransform);
    });

    canvas.on('touch:gesture', function(opt: any) {
      if (opt.e.touches && opt.e.touches.length === 2) {
         if (opt.self.state === "start") canvas.startZoom = canvas.getZoom();
         if (opt.self.state === "change") {
             let zoom = canvas.startZoom * opt.self.scale;
             zoom = Math.min(Math.max(zoom, 0.01), 20);
             const point = new window.fabric.Point(opt.self.x, opt.self.y);
             canvas.zoomToPoint(point, zoom);
             setViewport(canvas.getZoom(), canvas.viewportTransform);
         }
      }
    });

    const handleRemoteRemove = (e: any) => {
      const id = e.detail?.id;
      if (!id) return;
      const obj = canvas.getObjects().find((o: any) => o.id === id);
      if (obj) {
        canvas.remove(obj);
        canvas.requestRenderAll();
      }
    };
    window.addEventListener('removeCanvasObject', handleRemoteRemove);

    const updateDomFromObject = (obj: any) => {
       if (obj.isDomPlaceholder) {
         updateDomElement(obj.id, {
           x: obj.left,
           y: obj.top,
           scaleX: obj.scaleX,
           scaleY: obj.scaleY,
           rotation: obj.angle,
         });
       }
    };

    canvas.on('object:moving', (e: any) => {
      const obj = e.target;
      if (!obj) return;
      if (obj.type === 'activeSelection') obj.getObjects().forEach((o: any) => updateDomFromObject(o));
      else updateDomFromObject(obj);
    });

    canvas.on('object:scaling', (e: any) => {
      const obj = e.target;
      if (!obj) return;
      if (obj.type === 'activeSelection') obj.getObjects().forEach((o: any) => updateDomFromObject(o));
      else updateDomFromObject(obj);
    });

    canvas.on('object:rotating', (e: any) => {
      const obj = e.target;
      if (!obj) return;
      if (obj.type === 'activeSelection') obj.getObjects().forEach((o: any) => updateDomFromObject(o));
      else updateDomFromObject(obj);
    });

    canvas.on('object:removed', (e: any) => {
      const obj = e.target;
      if (obj && obj.isDomPlaceholder) removeDomElement(obj.id);
    });
    
    canvas.on('path:created', (e: any) => {
      const path = e.path;
      path.set({ id: `draw_${Date.now()}`, zIndex: 1 });
    });

    const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const rect = new window.fabric.Rect({
      id: 'box_1', left: center.x - 100, top: center.y, fill: '#00f0ff',
      width: 60, height: 60, originX: 'center', originY: 'center',
      shadow: new window.fabric.Shadow({ color: '#00f0ff', blur: 15 })
    });
    const circle = new window.fabric.Circle({
      id: 'circle_1', left: center.x + 100, top: center.y, fill: '#ff003c',
      radius: 40, originX: 'center', originY: 'center',
      shadow: new window.fabric.Shadow({ color: '#ff003c', blur: 15 })
    });
    canvas.add(rect, circle);
    
    onCanvasReady(fabricRef);
    addLog('Canvas mapping active.');

    return () => {
      canvas.dispose();
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('orientationchange', resizeCanvas);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('removeCanvasObject', handleRemoteRemove);
    };
  }, []);

  useAgentProcessor(fabricRef);

  useEffect(() => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    
    canvas.freeDrawingBrush = new window.fabric.PencilBrush(canvas);
    canvas.freeDrawingBrush.color = brushColor;
    canvas.freeDrawingBrush.width = brushWidth;

    if (activeTool === 'PENCIL') {
      canvas.isDrawingMode = true;
      canvas.selection = false;
      canvas.defaultCursor = 'crosshair';
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    } else {
      canvas.isDrawingMode = false;
      canvas.selection = (activeTool === 'SELECT');
      canvas.defaultCursor = 'default';
    }

    if (activeTool === 'TEXT') {
       const center = canvas.getVpCenter();
       const text = new window.fabric.IText('Type here...', {
         left: center.x, top: center.y,
         fontFamily: 'JetBrains Mono',
         fill: brushColor,
         fontSize: 20,
         originX: 'center', originY: 'center',
         id: `text_${Date.now()}`
       });
       canvas.add(text);
       canvas.setActiveObject(text);
       text.enterEditing();
       text.selectAll();
       canvas.requestRenderAll();
       setActiveTool('SELECT');
    } else if (activeTool === 'RECTANGLE') {
       const center = canvas.getVpCenter();
       const rect = new window.fabric.Rect({
         left: center.x, top: center.y,
         width: 100, height: 100,
         fill: 'transparent',
         stroke: brushColor,
         strokeWidth: 2,
         originX: 'center', originY: 'center',
         id: `rect_${Date.now()}`
       });
       canvas.add(rect);
       canvas.setActiveObject(rect);
       canvas.requestRenderAll();
       setActiveTool('SELECT');
    } else if (activeTool === 'CIRCLE') {
       const center = canvas.getVpCenter();
       const circle = new window.fabric.Circle({
         left: center.x, top: center.y,
         radius: 50,
         fill: 'transparent',
         stroke: brushColor,
         strokeWidth: 2,
         originX: 'center', originY: 'center',
         id: `circle_${Date.now()}`
       });
       canvas.add(circle);
       canvas.setActiveObject(circle);
       canvas.requestRenderAll();
       setActiveTool('SELECT');
    }

  }, [activeTool, brushColor, brushWidth, setActiveTool]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-cyber-black">
      <canvas ref={canvasRef} className="block" />
      <DomOverlay />
      <AgentCursor />
    </div>
  );
};
