
import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { useGeminiBrain } from '../hooks/useGeminiBrain';
import { CreatorTool } from '../types';

interface ChatInterfaceProps {
  canvasRef: React.MutableRefObject<any>;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ canvasRef }) => {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  
  const { 
    isThinking, isActing, actionQueue, logs, 
    setLastUploadedImage, abortTask,
    isCreatorMode, toggleCreatorMode, activeTool, setActiveTool, setBrushColor, brushColor,
    removeDomElement
  } = useStore();
  const { processUserPrompt } = useGeminiBrain();
  
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
        handleSubmitInternal(transcript);
      };
      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  const toggleListening = () => {
    if (isListening) recognitionRef.current?.stop();
    else {
      setIsListening(true);
      setInput('');
      recognitionRef.current?.start();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setLastUploadedImage(base64);
      useStore.getState().addLog(`Image Loaded: ${file.name}`);
      
      if (canvasRef.current) {
        window.fabric.Image.fromURL(base64, (img: any) => {
          const id = `img_${Date.now()}`;
          img.scaleToWidth(250);
          img.set({ 
            left: window.innerWidth/2, top: window.innerHeight/2, originX: 'center', originY: 'center', id: id,
            cornerColor: '#00f0ff', cornerSize: 10, transparentCorners: false
          });
          canvasRef.current.add(img);
          canvasRef.current.requestRenderAll();
        });
      }
      setInput("Check this image.");
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmitInternal(input);
  };

  const handleSubmitInternal = async (text: string) => {
    if (!text.trim() || isThinking) return;
    setInput('');
    useStore.getState().addMessage({ role: 'user', text: text });
    await processUserPrompt(text, canvasRef);
  };

  const handleDeleteSelection = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length > 0) {
      activeObjects.forEach((obj: any) => {
        canvas.remove(obj);
        if (obj.isDomPlaceholder) removeDomElement(obj.id);
      });
      canvas.discardActiveObject().requestRenderAll();
      useStore.getState().addLog(`Deleted ${activeObjects.length} objects.`);
    }
  };

  const isBusy = isThinking || isActing || actionQueue.length > 0;

  const ToolBtn = ({ tool, icon, label, shortcut }: { tool: CreatorTool, icon: React.ReactNode, label: string, shortcut?: string }) => {
    const isActive = activeTool === tool;
    return (
      <button
        onClick={() => setActiveTool(tool)}
        className={`group relative flex flex-col items-center justify-center h-10 w-10 sm:h-12 sm:w-12 rounded-xl transition-all duration-200 ${
          isActive 
            ? 'bg-cyber-primary text-black shadow-[0_0_15px_rgba(0,240,255,0.4)] translate-y-[-2px]' 
            : 'text-white/60 hover:text-white hover:bg-white/5'
        }`}
      >
        {icon}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/90 border border-white/10 rounded text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          {label} {shortcut && <span className="text-white/40 ml-1">[{shortcut}]</span>}
        </div>
      </button>
    );
  };

  return (
    <>
      {logs.length > 0 && (
        <div className="fixed top-4 right-4 z-40 hidden sm:flex flex-col items-end pointer-events-none">
           <div className="flex items-center gap-2 mb-2">
             <div className={`h-2 w-2 rounded-full ${isBusy ? 'bg-cyber-primary animate-pulse' : 'bg-green-500'}`} />
             <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest">
               {isBusy ? 'PROCESSING' : 'SYSTEM READY'}
             </span>
           </div>
           <div ref={scrollRef} className="w-64 max-h-32 overflow-hidden flex flex-col items-end space-y-1 mask-linear-fade">
            {logs.slice(0, 3).map((log, i) => (
              <div key={i} className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg border-r-2 border-cyber-primary/20 text-[10px] text-cyber-primary/80 font-mono shadow-sm">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PC Navigation Hints */}
      <div className="fixed bottom-6 right-6 z-40 hidden md:flex flex-col gap-2 items-end">
        <div className="bg-black/40 backdrop-blur px-3 py-2 rounded-lg border border-white/5 text-[9px] font-mono text-white/40 leading-relaxed text-right">
          <p><span className="text-white/60">[Space + Drag]</span> or <span className="text-white/60">[Right Click]</span> to PAN</p>
          <p><span className="text-white/60">[Wheel]</span> or <span className="text-white/60">[+/-]</span> to ZOOM</p>
          <p><span className="text-white/60">[0]</span> to RESET VIEW</p>
        </div>
      </div>

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4 flex flex-col items-center">
        
        <div 
          className={`
            w-[98%] max-w-xl bg-[#13131f]/95 backdrop-blur-xl border border-white/10 rounded-t-2xl rounded-b-lg mb-[-14px] pb-6 pt-3 px-6
            flex flex-col gap-3 shadow-2xl transition-all duration-300 ease-out origin-bottom
            ${isCreatorMode ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto' : 'opacity-0 translate-y-8 scale-95 pointer-events-none'}
          `}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 sm:gap-2">
              <ToolBtn 
                tool="SELECT" label="Select" 
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg>} 
              />
              <div className="w-px h-8 bg-white/10 mx-1" />
              <ToolBtn 
                tool="PENCIL" label="Draw" 
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 2l4 4-10 10H8v-4L18 2z"/><line x1="3" y1="22" x2="21" y2="22"/></svg>} 
              />
              <ToolBtn 
                tool="TEXT" label="Text" 
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>} 
              />
              <ToolBtn 
                tool="RECTANGLE" label="Box" 
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>} 
              />
              <ToolBtn 
                tool="CIRCLE" label="Circle" 
                icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/></svg>} 
              />
            </div>
            
            <button
              onClick={handleDeleteSelection}
              className="group flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-200"
              title="Delete Selection [Del]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              <span className="text-[10px] font-bold uppercase hidden sm:inline">Delete</span>
            </button>
          </div>

          <div className="h-px w-full bg-white/10" />

          <div className="flex items-center justify-between px-1">
             <span className="text-[10px] uppercase font-mono text-white/40 tracking-widest">Ink Color</span>
             <div className="flex gap-3">
               {['#00f0ff', '#ff003c', '#7000ff', '#ffffff', '#ffd700', '#00ff00'].map(c => (
                 <button
                   key={c}
                   onClick={() => setBrushColor(c)}
                   className={`
                     relative w-8 h-8 rounded-full transition-all duration-200 
                     ${brushColor === c ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#13131f]' : 'hover:scale-105 hover:opacity-100 opacity-60'}
                   `}
                   style={{ backgroundColor: c, boxShadow: brushColor === c ? `0 0 10px ${c}` : 'none' }}
                 />
               ))}
             </div>
          </div>
        </div>

        <div className={`
          relative z-20 w-full flex items-center gap-3 p-2 pl-3 rounded-2xl transition-all duration-300
          ${isBusy 
            ? 'bg-[#0a0a0f]/95 ring-1 ring-cyber-primary shadow-[0_0_40px_rgba(0,240,255,0.15)]' 
            : 'bg-[#13131f]/90 ring-1 ring-white/10 shadow-2xl hover:ring-white/20'
          }
          backdrop-blur-2xl
        `}>
          
          <div className="shrink-0 flex items-center justify-center w-8 h-8">
            {isBusy ? (
               <div className="relative h-4 w-4">
                 <div className="absolute inset-0 bg-cyber-primary rounded animate-spin" />
                 <div className="absolute inset-0 bg-cyber-primary blur-[2px] rounded animate-pulse" />
               </div>
            ) : (
               <div className="h-2 w-2 bg-white/20 rounded-full" />
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex-1">
            <input
              type="text"
              value={isListening ? 'Listening...' : input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Command the machine..."
              className="w-full bg-transparent text-sm font-medium text-white placeholder-white/30 focus:outline-none font-mono tracking-tight"
              disabled={isThinking}
            />
          </form>

          <div className="h-6 w-px bg-white/10" />

          <div className="flex items-center gap-1">
            <button
              onClick={toggleCreatorMode}
              className={`p-2.5 rounded-xl transition-all duration-200 ${isCreatorMode ? 'bg-cyber-primary text-black shadow-[0_0_15px_rgba(0,240,255,0.3)]' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
              title="Toggle Creator Tools [T]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>

            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-all"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            </button>

            <button
              onClick={toggleListening}
              className={`p-2.5 rounded-xl transition-all ${isListening ? 'text-red-500 bg-red-500/10' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
            </button>

            <button
              onClick={handleSubmit}
              disabled={!input || isThinking}
              className="ml-1 flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-cyber-primary hover:text-black hover:scale-105 active:scale-95 disabled:opacity-30 transition-all duration-200"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
