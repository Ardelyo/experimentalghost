
import { create } from 'zustand';
import { AgentState, AgentAction, Point, ChatMessage, DomElementState, CreatorTool } from './types';

interface AppStore extends AgentState {
  actionQueue: AgentAction[];
  messages: ChatMessage[];
  zoom: number;
  viewportTransform: number[];
  domElements: Record<string, DomElementState>;
  lastUploadedImage: string | null; // Base64
  
  // Creator Mode State
  isCreatorMode: boolean;
  activeTool: CreatorTool;
  brushColor: string;
  brushWidth: number;
  
  // Actions
  setCursorPosition: (pos: Point) => void;
  setThinking: (thinking: boolean) => void;
  setActing: (acting: boolean) => void;
  setClicking: (clicking: boolean) => void;
  setCurrentAction: (action: string | null) => void;
  setAgentMessage: (msg: string | null) => void;
  setLastUploadedImage: (img: string | null) => void;
  
  // Creator Actions
  toggleCreatorMode: () => void;
  setActiveTool: (tool: CreatorTool) => void;
  setBrushColor: (color: string) => void;
  
  addAction: (action: AgentAction) => void;
  addMessage: (msg: ChatMessage) => void;
  popAction: () => AgentAction | undefined;
  addLog: (log: string) => void;
  clearQueue: () => void;
  abortTask: () => void;
  setViewport: (zoom: number, transform: number[]) => void;
  
  // DOM Element Management
  updateDomElement: (id: string, state: Partial<DomElementState>) => void;
  removeDomElement: (id: string) => void;
  setDomElements: (elements: Record<string, DomElementState>) => void;
}

export const useStore = create<AppStore>((set, get) => ({
  cursorPosition: { x: 0, y: 0 },
  isThinking: false,
  isActing: false,
  isClicking: false,
  currentAction: null,
  agentMessage: null,
  actionQueue: [],
  messages: [{ role: 'model', text: 'Ghost System V3.5 [ADVANCED_EDIT] active.' }],
  logs: [],
  zoom: 1,
  viewportTransform: [1, 0, 0, 1, 0, 0],
  domElements: {},
  lastUploadedImage: null,
  
  // Creator Defaults
  isCreatorMode: false,
  activeTool: 'SELECT',
  brushColor: '#00f0ff',
  brushWidth: 3,

  setCursorPosition: (pos) => set({ cursorPosition: pos }),
  setThinking: (thinking) => set({ isThinking: thinking }),
  setActing: (acting) => set({ isActing: acting }),
  setClicking: (clicking) => set({ isClicking: clicking }),
  setCurrentAction: (action) => set({ currentAction: action }),
  setAgentMessage: (msg) => set({ agentMessage: msg }),
  setLastUploadedImage: (img) => set({ lastUploadedImage: img }),
  
  toggleCreatorMode: () => set((state) => ({ isCreatorMode: !state.isCreatorMode })),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setBrushColor: (color) => set({ brushColor: color }),
  
  addAction: (action) => set((state) => ({ actionQueue: [...state.actionQueue, action] })),
  
  popAction: () => {
    const state = get();
    if (state.actionQueue.length === 0) return undefined;
    const [next, ...rest] = state.actionQueue;
    set({ actionQueue: rest });
    return next;
  },

  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  
  addLog: (log) => set((state) => {
    const newLogs = [log, ...state.logs].slice(0, 50);
    return { logs: newLogs };
  }),

  clearQueue: () => set({ actionQueue: [] }),
  
  abortTask: () => {
    window.speechSynthesis.cancel();
    set({ 
      actionQueue: [], 
      isThinking: false, 
      isActing: false, 
      currentAction: null,
      agentMessage: 'Task aborted by user.' 
    });
  },

  setViewport: (zoom, transform) => set({ zoom, viewportTransform: transform }),

  updateDomElement: (id, newState) => set((state) => ({
    domElements: {
      ...state.domElements,
      [id]: { ...(state.domElements[id] || {}), ...newState }
    }
  })),

  removeDomElement: (id) => set((state) => {
    const newElements = { ...state.domElements };
    delete newElements[id];
    return { domElements: newElements };
  }),

  setDomElements: (elements) => set({ domElements: elements }),
}));
