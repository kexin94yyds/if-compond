import type { Handler } from '@netlify/functions';

// 可用的 Nitter 实例
const NITTER_INSTANCES = [
  'https://nitter.net',
  'https://xcancel.com',
  'https://nitter.poast.org',
  'https://nitter.catsarch.com',
];

const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const username = event.queryStringParameters?.username;
  
  if (!username) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Missing username parameter' }),
    };
  }

  // 尝试每个 Nitter 实例
  for (const instance of NITTER_INSTANCES) {
    try {
      const rssUrl = `${instance}/${username}/rss`;
      console.log(`Trying Nitter: ${rssUrl}`);
      
      const response = await fetch(rssUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; ContentDash/1.0)',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        console.log(`${instance} returned ${response.status}`);
        continue;
      }

      const xml = await response.text();
      
      // 简单解析 RSS XML
      const items = parseRssItems(xml);
      
      if (items.length > 0) {
        console.log(`✅ Success from ${instance}, found ${items.length} items`);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ 
            status: 'ok', 
            instance, 
            items 
          }),
        };
      }
    } catch (error) {
      console.log(`${instance} failed:`, error);
    }
  }

  return {
    statusCode: 404,
    headers,
    body: JSON.stringify({ 
      status: 'error', 
      error: 'No Nitter instance returned valid data' 
    }),
  };
};

// 简单的 RSS XML 解析
function parseRssItems(xml: string): any[] {
  const items: any[] = [];
  
  // 匹配所有 <item> 标签
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    
    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link');
    const pubDate = extractTag(itemXml, 'pubDate');
    const description = extractTag(itemXml, 'description');
    
    if (title || link) {
      items.push({
        title: decodeHtmlEntities(title || ''),
        link: link || '',
        pubDate: pubDate || '',
        description: decodeHtmlEntities(description || ''),
        content: description,
      });
    }
  }
  
  return items;
}

function extractTag(xml: string, tag: string): string | null {
  // 处理 CDATA
  const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 'i');
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1];
  
  // 普通标签
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

export { handler };
