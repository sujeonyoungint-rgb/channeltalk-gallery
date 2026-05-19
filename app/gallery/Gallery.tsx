'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import ImageCard from './ImageCard'
import Modal from './Modal'

const supabase = createClient()

// ============================================================
// 로그아웃 버튼
// ============================================================
function LogoutButton() {
  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <button
      onClick={handleLogout}
      className="text-sm text-gray-300 hover:text-white transition px-3 py-1.5 border border-gray-600 rounded hover:bg-gray-700"
    >
      로그아웃
    </button>
  )
}

// ============================================================
// 동기화 버튼
// ============================================================
function SyncButton() {
  const [syncInfo, setSyncInfo] = useState<{ status: string; step?: string } | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [justClickedAt, setJustClickedAt] = useState<number | null>(null)

  const API_URL = process.env.NEXT_PUBLIC_SYNC_API_URL || 'http://localhost:8000'

  // 쿨다운: 10분
  const COOLDOWN_MINUTES = 10

  const STEP_LABEL: Record<string, string> = {
    syncing: '📥 DB 저장 중...',
    analyzing: '🤖 AI 분석 중...',
    processing_images: '🖼️ 사진 분류 중...',
    done: '✅ 완료',
  }

  async function loadLastSync() {
    const { data } = await supabase
      .from('sync_log')
      .select('finished_at')
      .eq('status', 'success')
      .eq('step', 'done')
      .not('finished_at', 'is', null)
      .order('finished_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data?.finished_at) {
      setLastSyncedAt(data.finished_at)
    }
  }

  async function checkStatus() {
    try {
      const res = await fetch(`${API_URL}/sync/status`)
      const data = await res.json()
      setSyncInfo(data)
      return data
    } catch {
      setSyncInfo({ status: 'idle' })
      return { status: 'idle' }
    }
  }

  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => setError(null), 3000)
    return () => clearTimeout(timer)
  }, [error])

  useEffect(() => {
    loadLastSync()
    checkStatus().then((data) => {
      if (data.status === 'running') {
        const interval = setInterval(async () => {
          const d = await checkStatus()
          if (d.status !== 'running') {
            clearInterval(interval)
            await loadLastSync()
            setTimeout(() => setSyncInfo({ status: 'idle' }), 2000)
          }
        }, 2000)
      }
    })
  }, [])

  function formatRelative(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 1000 / 60)
    if (mins < 1) return '방금 전'
    if (mins < 60) return `${mins}분 전`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}시간 전`
    return `${Math.floor(hours / 24)}일 전`
  }

  const minsSinceLastSync = lastSyncedAt
    ? Math.floor((Date.now() - new Date(lastSyncedAt).getTime()) / 1000 / 60)
    : Infinity
  const isRateLimited = minsSinceLastSync < COOLDOWN_MINUTES
  const remainingMins = Math.max(0, COOLDOWN_MINUTES - minsSinceLastSync)

  const isRunning = syncInfo?.status === 'running'
  const canSync = !isRunning && !isRateLimited

  async function handleSync() {
    // 60초 안에 재클릭 차단 (race condition 방지)
    const LOCK_SECONDS = 60
    if (justClickedAt !== null) {
      const elapsed = (Date.now() - justClickedAt) / 1000
      if (elapsed < LOCK_SECONDS) {
        setError('이미 진행 중입니다. 잠시 후 다시 시도해주세요.')
        return
      }
    }

    if (!canSync) return
    setError(null)
    setJustClickedAt(Date.now())

    try {
      const res = await fetch(`${API_URL}/sync/full`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail || body.message || `동기화 실패 (${res.status})`)
      }
      setSyncInfo({ status: 'running', step: 'syncing' })

      const interval = setInterval(async () => {
        const d = await checkStatus()
        if (d.status !== 'running') {
          clearInterval(interval)
          await loadLastSync()
          setTimeout(() => setSyncInfo({ status: 'idle' }), 2000)
        }
      }, 2000)
    } catch (e: any) {
      setError(e.message)
      setJustClickedAt(null)  // 에러 시 잠금 해제
    }
  }

  const label =
    isRunning && syncInfo?.step
      ? STEP_LABEL[syncInfo.step] ?? '⏳ 동기화 중...'
      : '🔄 동기화'

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {lastSyncedAt && !isRunning && (
        <span className="text-xs text-gray-300">
          마지막: {formatRelative(lastSyncedAt)}
          {isRateLimited && (
            <span className="text-gray-400 ml-1.5">({remainingMins}분 후)</span>
          )}
        </span>
      )}

      <button
        onClick={handleSync}
        disabled={!canSync}
        title={
          isRunning
            ? '동기화 진행 중'
            : isRateLimited
            ? `${remainingMins}분 후 다시 시도 가능 (${COOLDOWN_MINUTES}분 제한)`
            : '데이터 동기화'
        }
        className={`text-sm px-3 py-1.5 rounded transition flex items-center gap-1.5 ${
          isRunning
            ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
            : isRateLimited
            ? 'bg-gray-500 text-gray-400 cursor-not-allowed'
            : 'bg-gray-600 hover:bg-gray-500 text-white'
        }`}
      >
        {label}
      </button>

      {error && <span className="text-xs text-red-400">⚠️ {error}</span>}
    </div>
  )
}

// ============================================================
// 페이지네이션 (현재±2 + 처음/끝 + 이전/다음)
// ============================================================
function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number
  totalPages: number
  onChange: (p: number) => void
}) {
  if (totalPages <= 1) return null

  // 현재 ±2 범위
  const window = 2
  const pages: (number | 'gap')[] = []

  const start = Math.max(1, page - window)
  const end = Math.min(totalPages, page + window)

  // 처음 페이지
  if (start > 1) {
    pages.push(1)
    if (start > 2) pages.push('gap')
  }

  for (let p = start; p <= end; p++) pages.push(p)

  // 끝 페이지
  if (end < totalPages) {
    if (end < totalPages - 1) pages.push('gap')
    pages.push(totalPages)
  }

  const btnBase =
    'min-w-[36px] h-9 px-2 rounded text-sm flex items-center justify-center transition'

  return (
    <div className="flex justify-center items-center gap-1 mt-8 flex-wrap">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        className={`${btnBase} bg-white border text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed`}
        aria-label="이전 페이지"
      >
        ‹
      </button>

      {pages.map((p, i) =>
        p === 'gap' ? (
          <span key={`gap-${i}`} className="px-1 text-gray-400">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`${btnBase} ${
              p === page
                ? 'bg-gray-800 text-white'
                : 'bg-white border hover:bg-gray-100 text-gray-700'
            }`}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages}
        className={`${btnBase} bg-white border text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed`}
        aria-label="다음 페이지"
      >
        ›
      </button>
    </div>
  )
}

// ============================================================
// Gallery 본체
// ============================================================
const PAGE_SIZE = 30

// 묶음 8 v7 분류 결과 기반 (v8: 결제 증빙 옵션 제거 - view에서 자동 처리됨):
// printed_output / kiosk_screen / original_photo / kiosk_body / no_output / other_defect
const SUBTYPE_OPTIONS: { value: string; label: string; values: string[] }[] = [
  { value: '', label: '불량유형 전체', values: [] },
  { value: 'defect', label: '불량', values: ['printed_output'] },
  { value: 'kiosk', label: '키오스크', values: ['kiosk_screen', 'kiosk_body'] },
  { value: 'no_output', label: '출력 안됨', values: ['no_output'] },
  { value: 'original_photo', label: '원본 사진', values: ['original_photo'] },
  { value: 'other_defect', label: '기타 불량', values: ['other_defect'] },
]

// v2.1: medium 제거 (high/low 이진)
const SEVERITY_OPTIONS = [
  { value: '', label: '심각도 전체' },
  { value: 'high', label: '시급' },
  { value: 'low', label: '낮음' },
]

// 기본 필터: 최근 7일
function getDefaultDateFrom(): string {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString().slice(0, 10)
}

// 날짜 문자열에 일수 더하기 (YYYY-MM-DD 형식 유지)
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export default function Gallery() {
  const [data, setData] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  function getToday(): string {
    return new Date().toISOString().slice(0, 10)
  }

  const [dateFrom, setDateFrom] = useState(getDefaultDateFrom())
  const [dateTo, setDateTo] = useState(getToday())
  const [subtype, setSubtype] = useState('')
  const [severity, setSeverity] = useState('')
  const [keyword, setKeyword] = useState('')
  const [keywordInput, setKeywordInput] = useState('')
  const [photosOnly, setPhotosOnly] = useState(false)

  async function fetchData(p = 1) {
    setLoading(true)
    const from = (p - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase
      .from('defect_images_view')
      .select('*', { count: 'exact' })
      .order('chat_created_at', { ascending: false })
      .range(from, to)

    if (dateFrom) query = query.gte('chat_created_at', dateFrom + 'T00:00:00')
    if (dateTo) query = query.lte('chat_created_at', dateTo + 'T23:59:59')
    if (severity) query = query.eq('ai_severity', severity)
    if (keyword) {
      query = query.or(
        `store_name.ilike.%${keyword}%,ai_summary.ilike.%${keyword}%`
      )
    }

    // v8: subtype 서버 필터링 (배열 교집합)
    if (subtype) {
      const opt = SUBTYPE_OPTIONS.find((o) => o.value === subtype)
      const matchValues = opt?.values ?? [subtype]
      if (matchValues.length > 0) {
        query = query.overlaps('subtypes', matchValues)
      }
    }

    // v8: "사진만 보기" 토글
    if (photosOnly) {
      query = query.gt('displayable_image_count', 0)
    }

    const { data: rows, count, error } = await query

    if (!error) {
      setData(rows ?? [])
      setTotal(count ?? 0)
    }
    setLoading(false)
  }

  useEffect(() => {
    setPage(1)
    fetchData(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, subtype, severity, keyword, photosOnly])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  function getStoreCount(storeName: string) {
    if (!storeName) return 0
    return data.filter((r: any) => r.store_name === storeName).length
  }

  function handleKeywordSearch(e: React.FormEvent) {
    e.preventDefault()
    setKeyword(keywordInput.trim())
  }

  function handlePageChange(p: number) {
    setPage(p)
    fetchData(p)
    // 페이지 변경 시 상단으로 부드럽게
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function shiftWeek(direction: 'prev' | 'next') {
    const delta = direction === 'prev' ? -7 : 7
    const newFrom = addDays(dateFrom, delta)
    const newTo = addDays(dateTo, delta)

    // 미래로 못 가게 (오늘 초과 시 차단)
    if (newTo > getToday()) return

    setDateFrom(newFrom)
    setDateTo(newTo)
  }

  const canGoNext = dateTo < getToday()

  function resetFilters() {
    setDateFrom(getDefaultDateFrom())
    setDateTo(getToday())
    setSubtype('')
    setSeverity('')
    setKeyword('')
    setKeywordInput('')
    setPhotosOnly(false)
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* 헤더 — 모바일: 세로 스택 / PC: 기존 가로 배치 */}
      <div className="bg-gray-800 px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:flex-wrap sm:justify-between sm:items-center gap-2">
        <h1 className="text-white font-semibold">📷 불량 사진 갤러리</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <SyncButton />
          <LogoutButton />
        </div>
      </div>

      {/* 검색 + 필터 */}
      <div className="px-4 sm:px-6 py-3 bg-gray-50 border-b">
        <div className="flex flex-wrap gap-2 items-center">
          {/* 날짜 범위 + 1주 단위 이동 — 모바일: 한 줄 전체 차지 */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => shiftWeek('prev')}
              className="border rounded px-2 py-1.5 text-sm bg-white text-gray-600 hover:bg-gray-100 transition"
              title="1주 전 보기"
              aria-label="1주 전"
            >
              ◀ 1주
            </button>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border rounded px-2 sm:px-3 py-1.5 text-sm bg-white w-[110px] sm:w-auto"
            />
            <span className="text-gray-400 text-sm">~</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border rounded px-2 sm:px-3 py-1.5 text-sm bg-white w-[110px] sm:w-auto"
            />
            <button
              onClick={() => shiftWeek('next')}
              disabled={!canGoNext}
              className={`border rounded px-2 py-1.5 text-sm transition ${
                canGoNext
                  ? 'bg-white text-gray-600 hover:bg-gray-100'
                  : 'bg-gray-100 text-gray-300 cursor-not-allowed'
              }`}
              title={canGoNext ? '1주 후 보기' : '더 이상 이동할 수 없습니다'}
              aria-label="1주 후"
            >
              1주 ▶
            </button>
          </div>

          {/* 필터 select */}
          <select
            value={subtype}
            onChange={(e) => setSubtype(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm bg-white"
          >
            {SUBTYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm bg-white"
          >
            {SEVERITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          {/* 검색창 */}
          <form
            onSubmit={handleKeywordSearch}
            className="flex gap-1 flex-1 sm:flex-none min-w-[200px]"
          >
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              placeholder="매장명 / AI요약 검색"
              className="border rounded px-3 py-1.5 text-sm flex-1 sm:w-52 focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white"
            />
            <button
              type="submit"
              className="bg-gray-800 text-white px-3 py-1.5 rounded text-sm hover:bg-gray-700 transition"
            >
              검색
            </button>
            {keyword && (
              <button
                type="button"
                onClick={() => {
                  setKeyword('')
                  setKeywordInput('')
                }}
                className="border px-2 py-1.5 rounded text-sm text-gray-500 hover:bg-gray-100 bg-white transition"
                aria-label="검색어 지우기"
              >
                ×
              </button>
            )}
          </form>

          {/* 사진만 보기 토글 + 총 건수 + 초기화 — 모바일: 한 줄 우측 정렬 / PC: 우측 끝 */}
          <div className="flex items-center gap-3 w-full sm:w-auto sm:ml-auto justify-end sm:justify-start">
            <button
              onClick={() => setPhotosOnly((v) => !v)}
              className={`text-xs px-3 py-1.5 rounded border transition ${
                photosOnly
                  ? 'bg-yellow-100 border-yellow-400 text-yellow-800 font-semibold'
                  : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
              title="영수증만 있는 chat은 숨기고 실제 사진이 있는 chat만 표시"
            >
              📷 사진만 보기 {photosOnly ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={resetFilters}
              className="text-xs text-gray-500 hover:text-gray-800 underline"
            >
              필터 초기화
            </button>
            <span className="text-sm text-gray-500 font-medium">
              총 <span className="text-gray-800 font-bold">{total}</span>건
            </span>
          </div>
        </div>
      </div>

      {/* 갤러리 */}
      <div className="overflow-y-auto p-4 sm:p-6 flex-1">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">
            불러오는 중...
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 text-gray-400 gap-3">
            <p>검색 결과가 없습니다</p>
            <button
              onClick={resetFilters}
              className="text-sm text-gray-600 hover:text-gray-800 underline"
            >
              필터 초기화
            </button>
          </div>
        ) : (
          // 모바일: 강제 2열 / PC: 기존 auto-fill 450px 그리드
          <div
            className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(450px,1fr))]"
            style={{
              gridAutoRows: 'auto',
            }}
          >
            {data.map((item) => (
              <ImageCard
                key={item.chat_id}
                item={item}
                storeCount={getStoreCount(item.store_name)}
                onClick={() => setSelected(item)}
              />
            ))}
          </div>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          onChange={handlePageChange}
        />
      </div>

      {selected && <Modal item={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}