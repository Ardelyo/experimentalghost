
import React, { useEffect, useState } from 'react';
import { useStore } from '../store';

export const AgentCursor: React.FC = () => {
  const { cursorPosition, isThinking, isActing, isClicking, currentAction, viewportTransform, agentMessage } = useStore();
  const [displayMessage, setDisplayMessage] = useState<string | null>(null);

  const zoom = viewportTransform[0];
  const panX = viewportTransform[4];
  const panY = viewportTransform[5];

  const screenX = cursorPosition.x * zoom + panX;
  const screenY = cursorPosition.y * zoom + panY;

  // Typewriter effect or simple delay for message
  useEffect(() => {
    if (agentMessage) {
      setDisplayMessage(agentMessage);
      const timer = setTimeout(() => {
        useStore.getState().setAgentMessage(null);
      }, 5000 + agentMessage.length * 50); // Read time
      return () => clearTimeout(timer);
    } else {
      setDisplayMessage(null);
    }
  }, [agentMessage]);

  return (
    <div
      className="pointer-events-none fixed z-50 flex flex-col items-start transition-all duration-75 will-change-transform"
      style={{
        left: screenX,
        top: screenY,
        transform: 'translate(0, 0)', 
      }}
    >
      {/* SPEECH BUBBLE */}
      {displayMessage && (
         <div className="absolute bottom-8 left-4 z-50 max-w-[250px] animate-in slide-in-from-bottom-2 fade-in duration-300">
           <div className="relative rounded-2xl rounded-bl-none bg-white p-3 text-sm font-medium text-black shadow-[0_8px_30px_rgba(0,0,0,0.3)]">
             {displayMessage}
             {/* Tail */}
             <div className="absolute -bottom-2 left-0 h-4 w-4 bg-white" style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}></div>
           </div>
         </div>
      )}

      {/* The Cursor Tip (Figma style) */}
      <div className={`relative transition-transform duration-100 ${isClicking ? 'scale-75' : 'scale-100'}`}>
        <svg 
          width="24" 
          height="24" 
          viewBox="0 0 24 24" 
          fill="none" 
          className="drop-shadow-lg"
        >
          <path 
            d="M3 3L10.5 20.5L13.5 13.5L20.5 10.5L3 3Z" 
            fill={isClicking ? "#ff003c" : "#00f0ff"} 
            stroke="white" 
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
        
        {/* Click Ripple Effect */}
        {isClicking && (
          <div className="absolute -left-2 -top-2 h-10 w-10 animate-ping rounded-full border-2 border-cyber-primary opacity-75"></div>
        )}
      </div>

      {/* Label / Status Bubble */}
      <div 
        className={`
          absolute left-5 top-5 flex items-center gap-2 whitespace-nowrap rounded-br-lg rounded-bl-lg rounded-tr-lg 
          bg-cyber-primary px-2.5 py-1 text-xs font-bold text-cyber-black shadow-[0_4px_12px_rgba(0,240,255,0.4)]
          transition-all duration-300 origin-top-left
          ${(isThinking || currentAction) ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}
        `}
      >
        {isThinking && (
          <div className="h-2 w-2 animate-bounce rounded-full bg-cyber-black" />
        )}
        <span>{currentAction || 'Thinking...'}</span>
      </div>
    </div>
  );
};
