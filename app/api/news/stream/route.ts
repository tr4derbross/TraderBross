import { INCOMING_NEWS, NewsItem } from "@/lib/mock-data";
import { getNewsItems } from "@/lib/news-service";

export const dynamic = "force-dynamic";

export async function GET() {
  let closed = false;
  let mockIndex = 0;
  const intervals: ReturnType<typeof setInterval>[] = [];
  const seenKeys = new Set<string>();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      send({ type: "connected" });

      // Try seeding up to 3 times before falling back to mock
      let seed: NewsItem[] = [];
      for (let attempt = 0; attempt < 3 && seed.length === 0; attempt++) {
        try {
          seed = await getNewsItems({ limit: 30 });
        } catch { /* retry */ }
      }

      for (const item of seed) {
        seenKeys.add(toSeenKey(item));
      }

      const pollNews = async () => {
        try {
          const news = await getNewsItems({ limit: 20 });
          const fresh = news.filter((item) => !seenKeys.has(toSeenKey(item))).slice(0, 5);
          for (const item of fresh) {
            seenKeys.add(toSeenKey(item));
            send({ type: "news", item });
          }
        } catch {
          // ignore
        }
      };

      const pollMock = () => {
        const item = { ...INCOMING_NEWS[mockIndex], timestamp: new Date(), type: "news" as const };
        send({ type: "news", item });
        mockIndex = (mockIndex + 1) % INCOMING_NEWS.length;
      };

      if (seed.length > 0) {
        // Real news: poll every 60s for fresh articles
        intervals.push(setInterval(pollNews, 60_000));
      } else {
        // Fallback: slower mock interval to reduce noise
        intervals.push(setInterval(pollMock, 20_000 + Math.random() * 10_000));
      }

      intervals.push(setInterval(() => send({ type: "ping" }), 25_000));
    },
    cancel() {
      closed = true;
      for (const id of intervals) clearInterval(id);
      intervals.length = 0;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function toSeenKey(item: NewsItem) {
  return item.id || item.headline.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 80);
}
