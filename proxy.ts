import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * 다음을 제외한 모든 경로에 proxy 적용:
     * - _next/static (Next.js 정적 파일)
     * - _next/image (이미지 최적화)
     * - favicon.ico
     * - 이미지 확장자
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
