// proxy.ts — 모든 접근 허용 (인증은 클라이언트에서 처리)
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: "/dashboard/:path*",
};
