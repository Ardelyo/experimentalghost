
import React, { useCallback } from 'react';
import { useStore } from '../store';
import { generateAgentActions } from '../services/geminiService';
import { CanvasObjectData, AgentAction, Point } from '../types';

export const useGeminiBrain = () => {
  const { setThinking, addAction, addLog, addMessage, setAgentMessage } = useStore();

  const speakJarvis = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const preferredVoices = ["Daniel", "Google UK English Male", "Microsoft James", "Arthur"];
    let selectedVoice = voices.find(v => preferredVoices.some(p => v.name.includes(p)));
    if (!selectedVoice) {
      selectedVoice = voices.find(v => v.lang.startsWith('en') && (v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('man')));
    }
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.pitch = 0.9;
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const processUserPrompt = useCallback(async (
    prompt: string, 
    canvasRef: React.MutableRefObject<any>
  ) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const storeState = useStore.getState();

    setThinking(true);
    addLog(`Neural scan initiated for: "${prompt}"`);

    try {
      // 1. Capture the Viewport State AT THE MOMENT OF REQUEST
      const vpt = [...canvas.viewportTransform]; // Copy array
      const zoom = canvas.getZoom();
      const width = canvas.width;
      const height = canvas.height;

      // 2. Generate a snapshot of ONLY the visible viewport
      // Fabric's toDataURL exports the whole world by default. 
      // We must calculate the crop rect.
      const invVpt = window.fabric.util.invertTransform(vpt);
      const tl = window.fabric.util.transformPoint({ x: 0, y: 0 }, invVpt);
      const br = window.fabric.util.transformPoint({ x: width, y: height }, invVpt);
      
      const dataUrl = canvas.toDataURL({
        format: 'png',
        multiplier: 1, // High quality for text reading
        left: tl.x,
        top: tl.y,
        width: br.x - tl.x,
        height: br.y - tl.y
      });

      // 3. Helper: Convert Screen Pixels (AI Vision) -> Canvas World Coordinates
      const screenToWorld = (screenX: number, screenY: number): Point => {
        // The AI sees an image of size `width` x `height`.
        // The `screenX` is pixels from left of that image.
        // We need to apply the inverse of the viewport transform captured earlier.
        const point = window.fabric.util.transformPoint(
          { x: screenX, y: screenY },
          invVpt
        );
        return { x: point.x, y: point.y };
      };

      const rawObjects = canvas.getObjects();
      
      const objectsJson: CanvasObjectData[] = rawObjects.map((obj: any) => {
        const baseData: CanvasObjectData = {
          id: obj.id || `obj_${Math.random().toString(36).substr(2, 9)}`,
          type: obj.type,
          left: Math.round(obj.left || 0),
          top: Math.round(obj.top || 0),
          fill: typeof obj.fill === 'string' ? obj.fill : 'mixed',
          angle: Math.round(obj.angle || 0),
          width: Math.round(obj.width * (obj.scaleX || 1)),
          height: Math.round(obj.height * (obj.scaleY || 1)),
        };

        if (obj.isDomPlaceholder) {
          baseData.htmlContent = storeState.domElements[obj.id]?.html;
        } else if (obj.svgSource) {
          baseData.svgContent = obj.svgSource; 
        } else if (obj.type === 'image') {
          baseData.imageUrl = "[Image present on canvas]";
        } else if (obj.type === 'i-text' || obj.type === 'text') {
          baseData.textContent = obj.text;
        }

        return baseData;
      });

      const { functionCalls, textResponse } = await generateAgentActions(
        prompt, 
        dataUrl, 
        objectsJson, 
        { width, height }, // Sending screen dimensions
        storeState.lastUploadedImage
      );
      
      const msg = textResponse || (functionCalls.length > 0 ? "Understood. Re-encoding parameters." : "No specific command detected.");
      
      addMessage({ role: 'model', text: msg });
      setAgentMessage(msg);
      speakJarvis(msg);

      functionCalls.forEach((call, index) => {
        const args = call.args || {};
        
        // 4. TRANSFORM COORDINATES HERE
        // Map the "Screen" coordinates from AI to "World" coordinates for the engine
        if (typeof args.x === 'number' && typeof args.y === 'number') {
          const worldPos = screenToWorld(args.x, args.y);
          args.x = worldPos.x;
          args.y = worldPos.y;
        }

        if (typeof args.toX === 'number' && typeof args.toY === 'number') {
          const worldPos = screenToWorld(args.toX, args.toY);
          args.toX = worldPos.x;
          args.toY = worldPos.y;
        }

        let actionType: AgentAction['type'];
        switch(call.name) {
          case 'move_cursor': actionType = 'MOVE_CURSOR'; break;
          case 'write_text': actionType = 'WRITE_TEXT'; break;
          case 'draw_path': actionType = 'DRAW_PATH'; break;
          case 'render_html_element': actionType = 'RENDER_HTML'; break;
          case 'edit_html_element': actionType = 'EDIT_HTML'; break;
          case 'create_vector_graphic': actionType = 'CREATE_SVG'; break;
          case 'edit_vector_graphic': actionType = 'EDIT_SVG'; break;
          case 'create_image': actionType = 'CREATE_IMAGE'; break;
          case 'drag_object': actionType = 'DRAG_OBJECT'; break;
          case 'delete_object': actionType = 'DELETE_OBJECT'; break;
          default: return;
        }

        addAction({
          id: `action_${Date.now()}_${index}`,
          type: actionType,
          payload: args,
          status: 'PENDING'
        });
      });

    } catch (error) {
      console.error(error);
      const errorMsg = "Core link error. System reset.";
      addMessage({ role: 'model', text: errorMsg });
      setAgentMessage(errorMsg);
      speakJarvis(errorMsg);
    } finally {
      setThinking(false);
    }
  }, [setThinking, addAction, addLog, addMessage, setAgentMessage]);

  return { processUserPrompt };
};
