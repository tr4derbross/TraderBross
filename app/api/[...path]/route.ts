import { NextRequest } from "next/server";

const DEFAULT_LOCAL_BACKEND = "http://127.0.0.1:4001";
const DEFAULT_PROD_BACKEND = "https://traderbross-production.up.railway.app";

function trimSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function resolveBackendBaseUrl() {
  const explicit =
    process.env.BACKEND_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "";

  if (explicit) return trimSlash(explicit);
  if (process.env.NODE_ENV === "production") return DEFAULT_PROD_BACKEND;
  return DEFAULT_LOCAL_BACKEND;
}

function cloneHeaders(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");
  headers.delete("accept-encoding");
  return headers;
}

async function proxy(request: NextRequest, method: string, path: string[]) {
  const backendBase = resolveBackendBaseUrl();
  const upstreamUrl = new URL(`${backendBase}/${path.join("/")}`);
  request.nextUrl.searchParams.forEach((value, key) => {
    upstreamUrl.searchParams.append(key, value);
  });

  const init: RequestInit = {
    method,
    headers: cloneHeaders(request),
    redirect: "manual",
    cache: "no-store",
  };

  if (method !== "GET" && method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  const upstream = await fetch(upstreamUrl.toString(), init);
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("transfer-encoding");
  responseHeaders.delete("connection");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, "GET", path || []);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, "POST", path || []);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, "DELETE", path || []);
}

export async function OPTIONS(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxy(request, "OPTIONS", path || []);
}
