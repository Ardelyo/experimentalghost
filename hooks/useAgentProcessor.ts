
import React, { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { Point } from '../types';

// Constants for "Human" feel
const MIN_ACTION_DELAY = 400; // Minimum time to "think" before clicking
const MAX_ACTION_DELAY = 1200;
const POST_ACTION_DELAY = 300; // Time to "verify" the action worked

export const useAgentProcessor = (canvasRef: React.MutableRefObject<any>) => {
  const popAction = useStore(state => state.popAction);
  const actionQueue = useStore(state => state.actionQueue);
  const setCursorPosition = useStore(state => state.setCursorPosition);
  const setActing = useStore(state => state.setActing);
  const setClicking = useStore(state => state.setClicking);
  const setCurrentAction = useStore(state => state.setCurrentAction);
  const updateDomElement = useStore(state => state.updateDomElement);
  const removeDomElement = useStore(state => state.removeDomElement);

  const processingRef = useRef(false);

  // Helper: Cubic Bezier for arcing mouse movements
  const getBezierPoint = (t: number, p0: Point, p1: Point, p2: Point, p3: Point): Point => {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;

    return {
      x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
      y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y
    };
  };

  // Helper: Simulate imperfect human aim adjustment
  const animateCursorTo = (targetX: number, targetY: number): Promise<void> => {
    return new Promise((resolve) => {
      const startPos = useStore.getState().cursorPosition;
      
      // 1. Calculate Control Points for a natural Arc
      const distance = Math.hypot(targetX - startPos.x, targetY - startPos.y);
      
      // Randomize the arc direction and intensity based on distance
      const arcIntensity = Math.min(distance * 0.2, 150); 
      const arcDirection = Math.random() > 0.5 ? 1 : -1;
      
      // Control Point 1 (Start influence)
      const cp1 = {
        x: startPos.x + (targetX - startPos.x) * 0.3 + (Math.random() * arcIntensity * arcDirection),
        y: startPos.y + (targetY - startPos.y) * 0.3 + (Math.random() * arcIntensity * arcDirection)
      };

      // Control Point 2 (End influence - tighten up aim)
      const cp2 = {
        x: targetX - (targetX - startPos.x) * 0.3 + (Math.random() * (arcIntensity * 0.5) * arcDirection),
        y: targetY - (targetY - startPos.y) * 0.3 + (Math.random() * (arcIntensity * 0.5) * arcDirection)
      };

      // 2. Determine Duration (Fitts's Law approximation)
      // Faster for long distances, slower for short precision adjustments
      // Base speed + variable based on distance
      const baseDuration = 600;
      const variableDuration = distance * 0.5; 
      const duration = Math.min(1800, Math.max(400, baseDuration + variableDuration));

      const startTime = performance.now();

      const animate = (currentTime: number) => {
        // Stop if queue was cleared (Aborted)
        if (useStore.getState().actionQueue.length === 0 && !processingRef.current) return resolve();

        const elapsed = currentTime - startTime;
        let progress = Math.min(elapsed / duration, 1);
        
        // Easing: easeInOutCubic for natural acceleration/deceleration
        // t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
        const ease = progress < 0.5 
          ? 4 * progress * progress * progress 
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        const nextPos = getBezierPoint(ease, startPos, cp1, cp2, { x: targetX, y: targetY });
        
        setCursorPosition(nextPos);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Snap to exact end to prevent rounding errors
          setCursorPosition({ x: targetX, y: targetY });
          resolve();
        }
      };
      
      requestAnimationFrame(animate);
    });
  };

  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const executeAction = async (tx: number, ty: number, label: string, fn: () => Promise<void> | void) => {
    setCurrentAction(label);
    
    // 1. Move to target with physics
    await animateCursorTo(tx, ty);
    
    // Check abort
    if (useStore.getState().actionQueue.length === 0 && processingRef.current && actionQueue.length === 0) return;

    // 2. Cognitive Pause (Thinking/Reading before clicking)
    // Complex actions get longer pauses
    const cognitiveLoad = label.includes('Synthesizing') || label.includes('Code') ? 500 : 0;
    const randomHesitation = Math.random() * (MAX_ACTION_DELAY - MIN_ACTION_DELAY) + MIN_ACTION_DELAY;
    await wait(randomHesitation + cognitiveLoad);

    // 3. Physical Click
    setClicking(true);
    await wait(150); // Down press duration
    setClicking(false);
    
    // 4. Execution
    await fn();
    
    // 5. Verification Pause (Looking at result)
    await wait(POST_ACTION_DELAY);
  };

  useEffect(() => {
    const processQueue = async () => {
      if (processingRef.current || actionQueue.length === 0) return;
      
      processingRef.current = true;
      setActing(true);
      const action = popAction();
      
      if (!action || !canvasRef.current) {
        processingRef.current = false;
        setActing(false);
        setCurrentAction(null);
        return;
      }
      
      const canvas = canvasRef.current;

      try {
        switch (action.type) {
          case 'RENDER_HTML': {
            const { html, width, height, x, y } = action.payload;
            await executeAction(x, y, 'Synthesizing App...', () => {
              const id = `web_${Date.now()}`;
              const placeholder = new window.fabric.Rect({
                left: x, top: y, width: width || 400, height: height || 300, 
                fill: 'rgba(255,255,255,0.01)', stroke: '#00f0ff', strokeWidth: 1,
                originX: 'center', originY: 'center', id: id,
                cornerColor: '#00f0ff', cornerSize: 10, transparentCorners: false,
              });
              placeholder.set('isDomPlaceholder', true);
              canvas.add(placeholder);
              updateDomElement(id, { id, html, x, y, width: width || 400, height: height || 300, scaleX: 1, scaleY: 1, rotation: 0, zIndex: 10 });
              canvas.setActiveObject(placeholder);
              canvas.requestRenderAll();
            });
            break;
          }
          case 'EDIT_HTML': {
            const { objectId, html } = action.payload;
            const target = canvas.getObjects().find((o: any) => o.id === objectId);
            if (target) {
              await executeAction(target.left, target.top, 'Refactoring Code...', () => {
                updateDomElement(objectId, { html });
                target.set('stroke', '#ff003c'); // Visual flash for change
                canvas.requestRenderAll();
                setTimeout(() => {
                  target.set('stroke', '#00f0ff');
                  canvas.requestRenderAll();
                }, 400);
              });
            }
            break;
          }
          case 'WRITE_TEXT': {
            const { text, x, y, fontSize, color } = action.payload;
            await executeAction(x, y, 'Typing...', () => {
              const id = `text_${Date.now()}`;
              const textObj = new window.fabric.IText(text, {
                left: x, top: y,
                fontFamily: 'JetBrains Mono',
                fill: color || '#ffffff',
                fontSize: fontSize || 20,
                originX: 'center', originY: 'center', // CENTER origin for accuracy
                id: id,
                cornerColor: '#00f0ff',
                selectable: true
              });
              canvas.add(textObj);
              canvas.setActiveObject(textObj);
              canvas.requestRenderAll();
            });
            break;
          }
          case 'DRAW_PATH': {
            const { pathSvg, x, y, strokeColor, strokeWidth } = action.payload;
            await executeAction(x, y, 'Scribbling...', () => {
              const path = new window.fabric.Path(pathSvg);
              const id = `draw_${Date.now()}`;
              // Force dimensions to be centered at X,Y
              path.set({
                left: x, top: y,
                fill: 'transparent',
                stroke: strokeColor || '#ff003c',
                strokeWidth: strokeWidth || 2,
                originX: 'center', originY: 'center',
                id: id,
                selectable: true
              });
              canvas.add(path);
              canvas.requestRenderAll();
            });
            break;
          }
          case 'CREATE_SVG': {
            const { svgXml, x, y } = action.payload;
            await executeAction(x, y, 'Drawing Vector...', () => {
              window.fabric.loadSVGFromString(svgXml, (objects: any[], options: any) => {
                if (!objects || objects.length === 0) return;
                const obj = window.fabric.util.groupSVGElements(objects, options);
                const id = `svg_${Date.now()}`;
                obj.set({ 
                  left: x, top: y, originX: 'center', originY: 'center', id: id,
                  cornerColor: '#7000ff', cornerSize: 10, transparentCorners: false,
                  svgSource: svgXml
                });
                canvas.add(obj);
                canvas.setActiveObject(obj);
                canvas.requestRenderAll();
              });
            });
            break;
          }
          case 'EDIT_SVG': {
            const { objectId, svgXml } = action.payload;
            const target = canvas.getObjects().find((o: any) => o.id === objectId);
            if (target) {
              await executeAction(target.left, target.top, 'Modifying Vector...', () => {
                window.fabric.loadSVGFromString(svgXml, (objects: any[], options: any) => {
                  if (!objects || objects.length === 0) return;
                  const newObj = window.fabric.util.groupSVGElements(objects, options);
                  newObj.set({ 
                    left: target.left, top: target.top, angle: target.angle,
                    scaleX: target.scaleX, scaleY: target.scaleY,
                    originX: 'center', originY: 'center', id: objectId,
                    cornerColor: '#7000ff', cornerSize: 10, transparentCorners: false,
                    svgSource: svgXml
                  });
                  canvas.remove(target);
                  canvas.add(newObj);
                  canvas.setActiveObject(newObj);
                  canvas.requestRenderAll();
                });
              });
            }
            break;
          }
          case 'CREATE_IMAGE': {
            const { base64, x, y, width, height } = action.payload;
            await executeAction(x, y, 'Importing Asset...', () => {
              window.fabric.Image.fromURL(base64, (img: any) => {
                const id = `img_${Date.now()}`;
                if (width) img.scaleToWidth(width);
                if (height) img.scaleToHeight(height);
                img.set({ 
                  left: x, top: y, originX: 'center', originY: 'center', id: id,
                  cornerColor: '#00f0ff', cornerSize: 10, transparentCorners: false
                });
                canvas.add(img);
                canvas.setActiveObject(img);
                canvas.requestRenderAll();
              });
            });
            break;
          }
          case 'DELETE_OBJECT': {
            const { objectId } = action.payload;
            const target = canvas.getObjects().find((o: any) => o.id === objectId);
            if (target) {
              await executeAction(target.left, target.top, 'Deleting...', () => {
                canvas.remove(target);
                removeDomElement(objectId);
                canvas.requestRenderAll();
              });
            }
            break;
          }
          case 'DRAG_OBJECT': {
            const { objectId, toX, toY } = action.payload;
            const target = canvas.getObjects().find((o: any) => o.id === objectId);
            if (target) {
              // Ensure we know the Center of the object
              const startX = target.left;
              const startY = target.top;

              // For dragging, we move to the object's CENTER, click, then drag to new CENTER
              setCurrentAction("Grabbing...");
              await animateCursorTo(startX, startY);
              
              setClicking(true);
              await wait(200); 
              
              setCurrentAction("Dragging...");
              
              // Slower, deliberate drag movement
              await new Promise<void>(resolve => {
                const duration = 800;
                const startTime = performance.now();
                const anim = (t: number) => {
                  if (useStore.getState().actionQueue.length === 0 && actionQueue.length === 0) return resolve();
                  const progress = Math.min((t - startTime) / duration, 1);
                  // Ease out quad
                  const ease = 1 - (1 - progress) * (1 - progress); 
                  
                  const curX = startX + (toX - startX) * ease;
                  const curY = startY + (toY - startY) * ease;
                  
                  target.set({ left: curX, top: curY });
                  target.setCoords();
                  
                  if (target.isDomPlaceholder) {
                    updateDomElement(target.id, { x: curX, y: curY });
                  }
                  
                  setCursorPosition({ x: curX, y: curY });
                  canvas.requestRenderAll();
                  
                  if (progress < 1) requestAnimationFrame(anim); 
                  else resolve();
                };
                requestAnimationFrame(anim);
              });
              
              setClicking(false);
              await wait(200);
            }
            break;
          }
          case 'MOVE_CURSOR': {
            const { x, y } = action.payload;
            // Just a move, but treated as an "Observation"
            setCurrentAction("Observing...");
            await animateCursorTo(x, y);
            await wait(500); // Look at the spot
            break;
          }
        }
      } catch (err) {
        console.error("Agent processor error:", err);
      }
      
      processingRef.current = false;
      setActing(false);
      setCurrentAction(null);
    };

    const interval = setInterval(processQueue, 100);
    return () => clearInterval(interval);
  }, [actionQueue, canvasRef, popAction, setCursorPosition, setActing, setClicking, setCurrentAction, updateDomElement, removeDomElement]);
};
