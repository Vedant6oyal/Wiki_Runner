
import { GoogleGenAI, Type } from "@google/genai";
import { AIResponse, WikiPage } from "../types";

export async function getNextMove(
  currentPage: WikiPage,
  targetPage: string,
  history: string[],
  apiKey?: string,
  modelName?: string
): Promise<AIResponse> {
  const key = apiKey || process.env.API_KEY || '';
  if (!key) throw new Error("API Key is missing. Please provide it in the settings.");

  const ai = new GoogleGenAI({ apiKey: key });
  
  const prompt = `
    You are an expert Wikipedia Speedrunner AI.
    Your goal is to reach the target page by clicking links from the current page.
    
    CRITICAL RULES:
    1. You CANNOT go back. You must always move forward.
    2. Choose the link that is semantically closest or most likely to lead to the target.
    3. If the target page title is in the list of links, you MUST select it.
    
    Current Page: ${currentPage.title}
    Target Page: ${targetPage}
    
    Current Page Summary: ${currentPage.summary}
    
    Available Links (${currentPage.links.length} total):
    ${currentPage.links.slice(0, 200).join(", ")}
    
    Path taken so far: ${history.join(" -> ")}
    
    Analyze the target and the current page's links. Explain your reasoning and then provide the exact name of the link you want to click.
  `;

  const response = await ai.models.generateContent({
    model: modelName || 'gemini-2.0-flash-exp',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          reasoning: {
            type: Type.STRING,
            description: "Step-by-step reasoning for choosing this specific link."
          },
          selectedLink: {
            type: Type.STRING,
            description: "The exact title of the link to click next."
          }
        },
        required: ["reasoning", "selectedLink"]
      }
    }
  });

  try {
    const data = JSON.parse(response.text || '{}');
    return {
      reasoning: data.reasoning || "No reasoning provided.",
      selectedLink: data.selectedLink || currentPage.links[0]
    };
  } catch (e) {
    console.error("Failed to parse AI response", e);
    return {
      reasoning: "Failed to parse AI response. Picking first link.",
      selectedLink: currentPage.links[0]
    };
  }
}
