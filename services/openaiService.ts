
import OpenAI from 'openai';
import { AIResponse, WikiPage } from "../types";

export async function getNextMove(
  currentPage: WikiPage,
  targetPage: string,
  history: string[],
  apiKey?: string,
  modelName?: string
): Promise<AIResponse> {
  const key = apiKey || process.env.VITE_OPENAI_API_KEY || '';
  if (!key) throw new Error("API Key is missing. Please provide it in the settings.");

  const openai = new OpenAI({ 
    apiKey: key,
    dangerouslyAllowBrowser: true // Required for client-side usage
  });

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
    
    Respond in JSON format with two keys: "reasoning" (string) and "selectedLink" (string).
  `;

  const completion = await openai.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: modelName || "gpt-4o-mini",
    response_format: { type: "json_object" },
  });

  try {
    const content = completion.choices[0].message.content;
    const data = JSON.parse(content || '{}');
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
