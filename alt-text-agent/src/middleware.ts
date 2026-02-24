import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Allow Contentful app origins (app runs in iframe from Contentful)
const ALLOWED_ORIGINS = [
  'https://app.contentful.com',
  /^https:\/\/[a-z0-9-]+\.contentful\.com$/,
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some((allowed) => {
    if (typeof allowed === 'string') return origin === allowed;
    return (allowed as RegExp).test(origin);
  });
}

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin');
  const allowed = isAllowedOrigin(origin) || !origin;

  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
  if (allowed && origin) {
    corsHeaders['Access-Control-Allow-Origin'] = origin;
  } else if (allowed) {
    corsHeaders['Access-Control-Allow-Origin'] = '*';
  }

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
  }

  const response = NextResponse.next();
  Object.entries(corsHeaders).forEach(([k, v]) => response.headers.set(k, v));
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
