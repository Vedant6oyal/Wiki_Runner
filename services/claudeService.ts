
import Anthropic from '@anthropic-ai/sdk';
import { AIResponse, WikiPage } from "../types";

export async function getNextMove(
  currentPage: WikiPage,
  targetPage: string,
  history: string[],
  apiKey?: string,
  modelName?: string
): Promise<AIResponse> {
  const key = apiKey || process.env.VITE_ANTHROPIC_API_KEY || '';
  if (!key) throw new Error("API Key is missing. Please provide it in the settings.");

  const anthropic = new Anthropic({ 
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
    
    Respond in strictly VALID JSON format with two keys: "reasoning" (string) and "selectedLink" (string). Do not include any markdown formatting.
  `;

  const message = await anthropic.messages.create({
    model: modelName || "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }]
  });

  try {
    let content = (message.content[0] as any).text;
    
    // Strip all variations of markdown code blocks
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    // Try to extract JSON object if there's surrounding text
    // Look for the first { and last } to extract just the JSON part
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      content = jsonMatch[0];
    }
    
    const data = JSON.parse(content || '{}');
    return {
      reasoning: data.reasoning || "No reasoning provided.",
      selectedLink: data.selectedLink || currentPage.links[0]
    };
  } catch (e) {
    console.error("Failed to parse Claude AI response. Raw content:", (message.content[0] as any).text);
    console.error("Parse error:", e);
    // Fallback: try to find a link in the raw text if JSON parsing fails
    return {
      reasoning: "Failed to parse AI response. Picking first link.",
      selectedLink: currentPage.links[0]
    };
  }
}
