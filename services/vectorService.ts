
import { pipeline, env } from '@xenova/transformers';
import { AIResponse, WikiPage } from "../types";

// Force remote models to avoid 404s on local server
env.allowLocalModels = false;
env.useBrowserCache = false;

// We use 'all-MiniLM-L6-v2' which is a distilled BERT model specifically trained 
// for sentence similarity. It is much more accurate than standard BERT or USE.
const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';

let extractor: any = null;
let isLoading = false;

export async function loadModel() {
  if (extractor) return extractor;
  if (isLoading) {
    while (isLoading) {
      await new Promise(r => setTimeout(r, 100));
    }
    return extractor;
  }

  isLoading = true;
  try {
    // Feature extraction pipeline with mean pooling and normalization
    // acts as a sentence embedding generator.
    extractor = await pipeline('feature-extraction', MODEL_NAME);
    console.log(`Vector model ${MODEL_NAME} loaded`);
  } catch (e) {
    console.error("Failed to load vector model", e);
    throw e;
  } finally {
    isLoading = false;
  }
  return extractor;
}

export async function getNextMove(
  currentPage: WikiPage,
  targetPage: string,
  history: string[] = []
): Promise<AIResponse> {
  // 0. Optimization: Immediate Target Check
  // If the target is directly available, take it immediately. 
  // This saves time and ensures 100% accuracy for the final step.
  const targetLower = targetPage.toLowerCase();
  const directLink = currentPage.links.find(l => l.toLowerCase() === targetLower);
  
  if (directLink) {
    return {
      selectedLink: directLink,
      reasoning: `Target identified! "${directLink}" is a direct match for the goal.`
    };
  }

  const model = await loadModel();
  if (!model) throw new Error("Model not loaded");

  // 1. Filter links
  // Create a set of visited pages to avoid loops
  const normalizedHistory = new Set(history.map(h => h.toLowerCase()));
  normalizedHistory.add(currentPage.title.toLowerCase()); // Add current page to visited

  const allUniqueLinks = Array.from(new Set(currentPage.links));

  // Prioritize Unvisited Links: Filter out any link that we have already visited
  let candidates = allUniqueLinks.filter(l => !normalizedHistory.has(l.toLowerCase()));

  let isBacktracking = false;

  // Fallback: If all links lead to visited pages (dead end), we must backtrack/loop to continue.
  if (candidates.length === 0) {
    candidates = allUniqueLinks.filter(l => l.toLowerCase() !== currentPage.title.toLowerCase());
    isBacktracking = true;
  }

  // Limit candidates to ensure UI doesn't freeze during inference
  // 200 is a safe limit for browser-based BERT inference
  candidates = candidates.slice(0, 200);

  if (candidates.length === 0) {
    return { selectedLink: currentPage.links[0] || "Main_Page", reasoning: "No valid links found." };
  }

  // 2. Embed Target
  // We use pooling: 'mean' and normalize: true to get a single ready-to-use vector
  const targetOutput = await model(targetPage, { pooling: 'mean', normalize: true });
  const targetVec = Array.from(targetOutput.data as Float32Array);

  // 3. Embed Candidates & Find Best Match
  const embeddings = await model(candidates, { pooling: 'mean', normalize: true });
  
  const hiddenSize = embeddings.dims[1]; // 384 for MiniLM
  const data = embeddings.data;

  let maxScore = -2;
  let bestLink = candidates[0];

  for (let i = 0; i < candidates.length; i++) {
    // Extract vector for candidate i
    // Manually slicing the flat array is faster than creating new subarrays
    let dot = 0;
    const offset = i * hiddenSize;
    for (let j = 0; j < hiddenSize; j++) {
      dot += targetVec[j] * data[offset + j];
    }

    if (dot > maxScore) {
      maxScore = dot;
      bestLink = candidates[i];
    }
  }

  let reasoningText = `BERT Similarity Score: ${maxScore.toFixed(3)}. "${bestLink}" is semantically closest to "${targetPage}".`;
  
  if (isBacktracking) {
    reasoningText += " (Note: All unique links were previously visited; forced to loop).";
  } else {
    reasoningText += " (Visited pages excluded to prevent loops).";
  }

  return {
    selectedLink: bestLink,
    reasoning: reasoningText
  };
}
