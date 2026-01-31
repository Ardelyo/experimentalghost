import React, { useRef, useState } from 'react';
import { CanvasManager } from './components/CanvasManager';
import { ChatInterface } from './components/ChatInterface';

const App: React.FC = () => {
  // We need to pass the fabric instance ref from Manager to Chat so the Brain can access it
  const canvasRef = useRef<any>(null);
  const [, setReady] = useState(false); // Force re-render once canvas is ready

  const handleCanvasReady = (ref: any) => {
    canvasRef.current = ref.current;
    setReady(true);
  };

  return (
    <div className="relative h-screen w-full overflow-hidden font-mono text-white">
      <CanvasManager onCanvasReady={handleCanvasReady} />
      
      {/* UI Overlay */}
      {canvasRef.current && (
        <ChatInterface canvasRef={canvasRef} />
      )}
      
      {/* Fallback/Loading if canvas isn't ready */}
      {!canvasRef.current && (
        <div className="absolute inset-0 flex items-center justify-center bg-black text-cyber-primary">
          INITIALIZING NEURAL LINK...
        </div>
      )}
    </div>
  );
};

export default App;