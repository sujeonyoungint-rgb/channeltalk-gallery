'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

// ⭐ 신규: URL 해시에서 에러/토큰 감지
  useEffect(() => {
    const hash = window.location.hash
    if (!hash) return

    const params = new URLSearchParams(hash.substring(1))
    
    // 1. 에러가 떨어진 경우
    if (params.get('error')) {
      const errorCode = params.get('error_code')
      const errorDesc = params.get('error_description')
      
      if (errorCode === 'otp_expired') {
        setError('초대 링크가 만료되었거나 이미 사용되었습니다. 관리자에게 새 초대를 요청해주세요.')
      } else {
        setError(decodeURIComponent(errorDesc ?? '인증 실패'))
      }
      
      // URL 해시 정리
      window.history.replaceState(null, '', '/login')
      return
    }

    // 2. access_token이 떨어진 경우 (invitation 성공) → 비번 설정으로
    if (params.get('access_token')) {
      // Supabase가 자동으로 세션 처리하니까 잠깐 기다린 후 이동
      setTimeout(() => {
        router.push('/auth/update-password')
      }, 300)
    }
  }, [router])


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(getKoreanError(error.message))
      setLoading(false)
      return
    }

    // 미들웨어가 / 로 자동 처리하지만, 명시적으로
    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2 text-center">
          📷 불량 사진 갤러리
        </h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          로그인 후 이용해주세요
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이메일
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="email@example.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-800 text-white py-2 rounded font-medium hover:bg-gray-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-6">
          계정이 없으신가요? 관리자에게 문의해주세요.
        </p>
      </div>
    </div>
  )
}

function getKoreanError(msg: string): string {
  const lower = msg.toLowerCase()
  if (lower.includes('invalid login credentials')) {
    return '이메일 또는 비밀번호가 올바르지 않습니다.'
  }
  if (lower.includes('email not confirmed')) {
    return '이메일 인증이 완료되지 않았습니다.'
  }
  if (lower.includes('too many requests')) {
    return '시도 횟수가 너무 많습니다. 잠시 후 다시 시도해주세요.'
  }
  return `로그인 실패: ${msg}`
}