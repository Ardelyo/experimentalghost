
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { CanvasObjectData } from "../types";
import { GEMINI_MODEL, AGENT_THINKING_BUDGET } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const tools: FunctionDeclaration[] = [
  {
    name: "move_cursor",
    description: "Moves the virtual cursor to specific coordinates. Use this to 'look' at things or before starting a sequence.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        x: { type: Type.NUMBER },
        y: { type: Type.NUMBER },
      },
      required: ["x", "y"],
    },
  },
  {
    name: "write_text",
    description: "Writes text directly on the canvas.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING },
        x: { type: Type.NUMBER },
        y: { type: Type.NUMBER },
        fontSize: { type: Type.NUMBER, description: "Default is 20" },
        color: { type: Type.STRING, description: "Hex code, default #ffffff" },
      },
      required: ["text", "x", "y"],
    },
  },
  {
    name: "draw_path",
    description: "Draws a freehand-style line or shape. The path should be relative to 0,0. The X,Y parameters determine where the center of this drawing is placed.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        pathSvg: { type: Type.STRING, description: "SVG 'd' attribute string (e.g., 'M 0 0 L 50 50'). Keep paths simple." },
        x: { type: Type.NUMBER, description: "Center X position of the drawing" },
        y: { type: Type.NUMBER, description: "Center Y position of the drawing" },
        strokeColor: { type: Type.STRING, description: "Hex code" },
        strokeWidth: { type: Type.NUMBER },
      },
      required: ["pathSvg", "x", "y"],
    },
  },
  {
    name: "render_html_element",
    description: "Creates a FUNCTIONAL INTERFACE or WEB APP.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        html: { type: Type.STRING, description: "Full HTML + CSS <style>." },
        width: { type: Type.NUMBER },
        height: { type: Type.NUMBER },
        x: { type: Type.NUMBER },
        y: { type: Type.NUMBER },
      },
      required: ["html", "width", "height", "x", "y"],
    },
  },
  {
    name: "edit_html_element",
    description: "Refactors or updates an EXISTING HTML element.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        objectId: { type: Type.STRING, description: "ID of the element to edit." },
        html: { type: Type.STRING, description: "New full HTML/CSS source." },
      },
      required: ["objectId", "html"],
    },
  },
  {
    name: "create_vector_graphic",
    description: "Creates a detailed VECTOR ILLUSTRATION.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        svgXml: { type: Type.STRING, description: "Valid SVG XML string." },
        x: { type: Type.NUMBER },
        y: { type: Type.NUMBER },
      },
      required: ["svgXml", "x", "y"],
    },
  },
  {
    name: "edit_vector_graphic",
    description: "Updates an EXISTING SVG element.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        objectId: { type: Type.STRING, description: "ID of the SVG to edit." },
        svgXml: { type: Type.STRING, description: "New SVG XML source." },
      },
      required: ["objectId", "svgXml"],
    },
  },
  {
    name: "create_image",
    description: "Places a specific image onto the canvas.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        base64: { type: Type.STRING, description: "Base64 image data." },
        x: { type: Type.NUMBER },
        y: { type: Type.NUMBER },
        width: { type: Type.NUMBER },
        height: { type: Type.NUMBER },
      },
      required: ["base64", "x", "y"],
    },
  },
  {
    name: "drag_object",
    description: "Moves an existing object to new coordinates.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        objectId: { type: Type.STRING },
        toX: { type: Type.NUMBER },
        toY: { type: Type.NUMBER },
      },
      required: ["objectId", "toX", "toY"],
    },
  },
  {
    name: "delete_object",
    description: "Removes an object from the workspace.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        objectId: { type: Type.STRING },
      },
      required: ["objectId"],
    },
  }
];

export interface ViewportBounds {
  width: number;
  height: number;
}

export const generateAgentActions = async (
  prompt: string,
  canvasImageBase64: string,
  canvasObjects: CanvasObjectData[],
  viewport: ViewportBounds,
  highResInputImage?: string | null
) => {
  const cleanCanvasBase64 = canvasImageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
  
  const systemInstruction = `
    You are 'Ghost', an elite Digital Architect collaborating with a human in real-time.
    
    **CRITICAL COORDINATE SYSTEM RULES:**
    1. **Visual Context:** The image you receive is the **CURRENT VISIBLE SCREEN**.
    2. **Coordinate Mapping:** 
       - x=0, y=0 is the TOP-LEFT of the image.
       - x=${viewport.width}, y=${viewport.height} is the BOTTOM-RIGHT.
    3. **Center-Targeting:** ALL coordinates you generate (for creating, moving, or rendering) will be treated as the **CENTER POINT** of that object.
       - To place something in the top-left corner, use x=${viewport.width * 0.1}, y=${viewport.height * 0.1}.
       - To place something in the center, use x=${viewport.width / 2}, y=${viewport.height / 2}.
    
    **BEHAVIOR PROTOCOL:**
    1. **Plan Visually:** Before building complex apps, use \`write_text\` to list steps, or \`draw_path\` to sketch arrows/circles indicating plans.
    2. **Explain Step-by-Step:** Write short notes on the canvas (e.g., "Step 1: Layout") next to work areas.
    3. **Precision:** When using \`drag_object\`, ensure \`toX\` and \`toY\` are valid visible locations.
    
    **TOOL USAGE:**
    - **ANNOTATION (write_text):** Use for plans, labels, answers.
    - **SCRIBBLING (draw_path):** Use for arrows, circles, connectors.
    - **APPS (render_html_element):** For functional UI.
    
    **CONTEXT:**
    - Visible Viewport Size: ${viewport.width}x${viewport.height}
    - Existing Objects: ${canvasObjects.map(o => `${o.id} (${o.type}) at ${o.left},${o.top} ${o.textContent ? `[Text: ${o.textContent}]` : ''}`).join(' | ')}
    
    Respond with a clear plan and precise tool calls.
  `;

  const userParts = [
    { inlineData: { mimeType: "image/png", data: cleanCanvasBase64 } },
    ...(highResInputImage ? [{ inlineData: { mimeType: "image/png", data: highResInputImage.replace(/^data:image\/(png|jpeg|jpg);base64,/, "") } }] : []),
    { text: `COMMAND: ${prompt}` }
  ];

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: "user",
        parts: userParts
      }
    ],
    config: {
      tools: [{ functionDeclarations: tools }],
      systemInstruction: systemInstruction,
      thinkingConfig: {
        thinkingBudget: AGENT_THINKING_BUDGET
      }
    }
  });

  const functionCalls = response.functionCalls || [];
  const textResponse = response.text || "";

  return { functionCalls, textResponse };
};
