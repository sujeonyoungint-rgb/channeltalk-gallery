import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })

    if (!error) {
      // invitation/recovery이면 비번 설정 페이지로
      if (type === 'invite' || type === 'recovery') {
        return NextResponse.redirect(`${origin}/auth/update-password`)
      }
      // 그 외(이메일 인증 등)는 홈으로
      return NextResponse.redirect(`${origin}/`)
    }

    console.error('Verify OTP error:', error.message)
  }

  // 실패: 로그인 페이지로 에러 메시지와 함께
  return NextResponse.redirect(`${origin}/login?error=invalid_invite`)
}