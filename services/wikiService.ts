
import { WikiPage } from '../types';

const WIKI_API = 'https://en.wikipedia.org/w/api.php';

export async function fetchRandomPageTitle(): Promise<string> {
  const url = `${WIKI_API}?action=query&list=random&rnnamespace=0&rnlimit=1&format=json&origin=*`;
  const response = await fetch(url);
  const data = await response.json();
  return data.query.random[0].title;
}

export async function fetchPageData(title: string): Promise<WikiPage> {
  // Use action=parse to get full HTML and links in one go
  // We include redirects=1 to follow any redirects automatically
  const url = `${WIKI_API}?action=parse&page=${encodeURIComponent(title)}&prop=text|links|displaytitle&format=json&origin=*&redirects=1`;
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error.info);
  }

  const parseData = data.parse;
  let htmlContent = parseData.text['*'];

  // BUG FIX: Rewrite relative image and link paths to absolute Wikipedia URLs
  // This ensures images load and links look 'real'
  htmlContent = htmlContent.replace(/src="\/\//g, 'src="https://');
  htmlContent = htmlContent.replace(/href="\//g, 'href="https://en.wikipedia.org/');
  // Ensure protocol-relative URLs for images are fixed
  htmlContent = htmlContent.replace(/src="\/w\/extensions/g, 'src="https://en.wikipedia.org/w/extensions');

  const links = (parseData.links || [])
    .filter((l: any) => l.ns === 0 && l.exists !== undefined) 
    .map((l: any) => l['*']);

  // Fetch summary for AI context
  const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(parseData.title)}`;
  const summaryRes = await fetch(summaryUrl);
  const summaryData = await summaryRes.json();

  return {
    title: parseData.title,
    summary: summaryData.extract || 'No summary available.',
    links: links,
    extract: htmlContent
  };
}

export async function searchPage(query: string): Promise<string[]> {
  const url = `${WIKI_API}?action=opensearch&search=${encodeURIComponent(query)}&limit=5&format=json&origin=*`;
  const response = await fetch(url);
  const data = await response.json();
  return data[1]; 
}
