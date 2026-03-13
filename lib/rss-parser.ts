// Lightweight server-side RSS/Atom parser — no external dependencies

export interface RSSItem {
  guid: string;
  title: string;
  link: string;
  description: string;
  pubDate: string;
  author?: string;
}

function extractTag(xml: string, tag: string): string {
  // Handles <tag>text</tag> and <tag><![CDATA[text]]></tag>
  const regex = new RegExp(
    `<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`,
    "i"
  );
  return xml.match(regex)?.[1]?.trim() ?? "";
}

function extractAttr(xml: string, tag: string, attr: string): string {
  const regex = new RegExp(`<${tag}[^>]+${attr}=["']([^"']+)["']`, "i");
  return xml.match(regex)?.[1]?.trim() ?? "";
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").trim();
}

export async function fetchRSS(url: string, timeoutMs = 10_000): Promise<RSSItem[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "TraderBross/1.1 RSS Reader",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) return [];

    const text = await res.text();

    // Detect Atom vs RSS 2.0
    const isAtom = /<feed[\s>]/i.test(text);
    const itemTag = isAtom ? "entry" : "item";
    const itemRegex = new RegExp(`<${itemTag}[\\s>]([\\s\\S]*?)<\\/${itemTag}>`, "gi");

    const items: RSSItem[] = [];
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(text)) !== null) {
      const chunk = match[1];

      const title = stripHtml(extractTag(chunk, "title"));

      // Link: <link>url</link> OR <link href="url" />
      let link = extractTag(chunk, "link");
      if (!link || link.startsWith("<")) {
        link = extractAttr(chunk, "link", "href");
      }
      link = stripHtml(link);

      const rawDesc =
        extractTag(chunk, "content:encoded") ||
        extractTag(chunk, "content") ||
        extractTag(chunk, "description") ||
        extractTag(chunk, "summary");
      const description = stripHtml(rawDesc).slice(0, 400);

      const pubDate =
        extractTag(chunk, "pubDate") ||
        extractTag(chunk, "published") ||
        extractTag(chunk, "updated") ||
        new Date().toISOString();

      const author =
        stripHtml(extractTag(chunk, "dc:creator")) ||
        stripHtml(extractTag(chunk, "author")) ||
        stripHtml(extractTag(chunk, "name"));

      const guid =
        stripHtml(extractTag(chunk, "guid")) ||
        stripHtml(extractTag(chunk, "id")) ||
        link;

      if (title && (link || guid)) {
        items.push({ guid, title, link: link || guid, description, pubDate, author });
      }
    }

    return items.slice(0, 25);
  } catch {
    return [];
  }
}
