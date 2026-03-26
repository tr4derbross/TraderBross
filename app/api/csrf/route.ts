import { NextRequest, NextResponse } from "next/server";
import { ensureCsrfCookie, getCsrfHeaderName } from "@/lib/request-security";

function json(payload: unknown, status = 200) {
  return new NextResponse(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function GET(request: NextRequest) {
  const response = json({
    ok: true,
    header: getCsrfHeaderName(),
  });
  ensureCsrfCookie(request, response);
  return response;
}

