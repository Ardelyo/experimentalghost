
import React from 'react';
import { useStore } from '../store';
import { DomElementState } from '../types';

export const DomOverlay: React.FC = () => {
  const domElements = useStore(state => state.domElements);
  const viewportTransform = useStore(state => state.viewportTransform);
  const isActing = useStore(state => state.isActing);
  const removeDomElement = useStore(state => state.removeDomElement);

  const zoom = viewportTransform[0];
  const panX = viewportTransform[4];
  const panY = viewportTransform[5];

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    removeDomElement(id);
    const event = new CustomEvent('removeCanvasObject', { detail: { id } });
    window.dispatchEvent(event);
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {Object.values(domElements).map((el: DomElementState) => {
        const screenX = el.x * zoom + panX;
        const screenY = el.y * zoom + panY;
        const screenWidth = el.width * el.scaleX * zoom;
        const screenHeight = el.height * el.scaleY * zoom;
        const rotation = el.rotation;

        return (
          <div
            key={el.id}
            className={`absolute flex flex-col overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-cyber-gray will-change-transform transition-opacity duration-300 ${isActing ? 'opacity-40' : 'opacity-100'}`}
            style={{
              width: `${screenWidth}px`,
              height: `${screenHeight}px`,
              transform: `translate3d(${screenX - screenWidth / 2}px, ${screenY - screenHeight / 2}px, 0) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
              pointerEvents: 'none', 
            }}
          >
            {/* Header / Command Bar */}
            <div className="pointer-events-none flex h-9 w-full items-center gap-2 bg-[#0d0d0f] px-3 border-b border-white/5 shrink-0 select-none">
              <div className="pointer-events-auto flex gap-2 z-20">
                <button 
                  onMouseDown={(e) => e.stopPropagation()} 
                  onClick={(e) => handleDelete(el.id, e)}
                  className="group flex h-4 w-4 items-center justify-center rounded-full bg-[#ff5f56] hover:bg-red-500 shadow-sm transition-all active:scale-90"
                  title="Remove Element"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" className="hidden group-hover:block"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
                <div className="h-4 w-4 rounded-full bg-[#ffbd2e]/20 border border-[#ffbd2e]/50"></div>
                <div className="h-4 w-4 rounded-full bg-[#27c93f]/20 border border-[#27c93f]/50"></div>
              </div>
              <div className="flex-1 text-right text-[9px] text-white/30 font-mono tracking-widest uppercase truncate pr-2">
                {el.id}
              </div>
            </div>

            {/* Application Content */}
            <div className="flex-1 bg-white relative overflow-hidden pointer-events-auto">
              <iframe
                srcDoc={el.html}
                title={el.id}
                className={`absolute inset-0 h-full w-full border-0 ${isActing ? 'pointer-events-none' : 'pointer-events-auto'}`}
                sandbox="allow-scripts allow-same-origin allow-forms"
              />
              
              {isActing && (
                <div className="absolute inset-0 z-50 bg-[#00f0ff]/10 flex items-center justify-center backdrop-blur-[2px]">
                  <div className="bg-black/80 px-3 py-1 rounded border border-cyber-primary text-cyber-primary text-[10px] font-mono animate-pulse tracking-tighter">
                    AGENT_EXECUTING_CODE
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
