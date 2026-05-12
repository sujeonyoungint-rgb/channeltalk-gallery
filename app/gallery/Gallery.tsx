'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import ImageCard from './ImageCard'
import Modal from './Modal'

function SyncButton() {
  const [syncInfo, setSyncInfo] = useState<{status: string, step?: string} | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const API_URL = process.env.NEXT_PUBLIC_SYNC_API_URL || 'http://localhost:8000'

  const STEP_LABEL: Record<string, string> = {
    syncing: '📥 DB 저장 중...',
    analyzing: '🤖 AI 분석 중...',
    processing_images: '🖼️ 사진 분류 중...',
    done: '✅ 완료',
  }

  // 마지막 성공 동기화 시각 조회
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

  // FastAPI 상태 조회
  async function checkStatus() {
    try {
      const res = await fetch(`${API_URL}/sync/status`)
      const data = await res.json()
      setSyncInfo(data)
      return data
    } catch (e) {
      setSyncInfo({ status: 'idle' })
      return { status: 'idle' }
    }
  }

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

  // 상대 시각 포맷
  function formatRelative(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 1000 / 60)
    if (mins < 1) return '방금 전'
    if (mins < 60) return `${mins}분 전`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}시간 전`
    return `${Math.floor(hours / 24)}일 전`
  }

  // Rate limit 계산
  const minsSinceLastSync = lastSyncedAt
    ? Math.floor((Date.now() - new Date(lastSyncedAt).getTime()) / 1000 / 60)
    : Infinity
  const isRateLimited = minsSinceLastSync < 60
  const remainingMins = Math.max(0, 60 - minsSinceLastSync)

  const isRunning = syncInfo?.status === 'running'
  const canSync = !isRunning && !isRateLimited

  async function handleSync() {
    if (!canSync) return
    setError(null)
    
    try {
      const res = await fetch(`${API_URL}/sync/full`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail || `동기화 실패 (${res.status})`)
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
    }
  }

  // 버튼 라벨
  const label = isRunning && syncInfo?.step
    ? STEP_LABEL[syncInfo.step] ?? '⏳ 동기화 중...'
    : '🔄 동기화'

  return (
    <div className="flex items-center gap-3">
      {lastSyncedAt && !isRunning && (
        <span className="text-xs text-gray-300">
          마지막: {formatRelative(lastSyncedAt)}
          {isRateLimited && (
            <span className="text-gray-400 ml-1.5">({remainingMins}분 후 가능)</span>
          )}
        </span>
      )}
      
      <button
        onClick={handleSync}
        disabled={!canSync}
        title={
          isRunning ? '동기화 진행 중' :
          isRateLimited ? `${remainingMins}분 후 다시 시도 가능 (1시간 제한)` :
          '데이터 동기화'
        }
        className={`text-sm px-3 py-1.5 rounded transition flex items-center gap-1.5 ${
          isRunning ? 'bg-gray-600 text-gray-300 cursor-not-allowed' :
          isRateLimited ? 'bg-gray-500 text-gray-400 cursor-not-allowed' :
          'bg-gray-600 hover:bg-gray-500 text-white'
        }`}
      >
        {label}
      </button>
      
      {error && (
        <span className="text-xs text-red-400">⚠️ {error}</span>
      )}
    </div>
  )
}

const PAGE_SIZE = 20

const SUBTYPE_OPTIONS = [
  { value: '', label: '불량유형 전체' },
  { value: 'printed_output', label: '인쇄 불량' },
  { value: 'kiosk_screen', label: '키오스크 화면' },
]

const SEVERITY_OPTIONS = [
  { value: '', label: '심각도 전체' },
  { value: 'high', label: '높음' },
  { value: 'medium', label: '보통' },
  { value: 'low', label: '낮음' },
]

export default function Gallery() {
  const [data, setData] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [subtype, setSubtype] = useState('')
  const [severity, setSeverity] = useState('')
  const [keyword, setKeyword] = useState('')
  const [keywordInput, setKeywordInput] = useState('')

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
      query = query.or(`store_name.ilike.%${keyword}%,ai_summary.ilike.%${keyword}%`)
    }

    const { data: rows, count, error } = await query

    if (!error) {
      let filtered = rows ?? []
      if (subtype) {
        filtered = filtered.filter((r: any) =>
          r.images?.some((img: any) => img.vision_analysis?.subtype === subtype)
        )
      }
      setData(filtered)
      setTotal(count ?? 0)
    }
    setLoading(false)
  }

  useEffect(() => {
    setPage(1)
    fetchData(1)
  }, [dateFrom, dateTo, subtype, severity, keyword])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  function getStoreCount(storeName: string) {
    if (!storeName) return 0
    return data.filter((r: any) => r.store_name === storeName).length
  }

  function handleKeywordSearch(e: React.FormEvent) {
    e.preventDefault()
    setKeyword(keywordInput.trim())
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* 헤더 */}
      {/* 타이틀 */}
        <div className="bg-gray-800 px-6 py-3 flex justify-between items-center">
          <h1 className="text-lg font-bold text-white tracking-tight">📷 불량 사진 갤러리</h1>
          <SyncButton />
        </div>

       {/* 검색 + 필터 한 줄 */}
        <div className="px-6 py-3 bg-gray-50 flex flex-wrap gap-2 items-center">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border rounded px-3 py-1.5 text-sm bg-white" />
          <span className="text-gray-400 text-sm">~</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border rounded px-3 py-1.5 text-sm bg-white" />
          <select value={subtype} onChange={(e) => setSubtype(e.target.value)} className="border rounded px-3 py-1.5 text-sm bg-white">
            {SUBTYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="border rounded px-3 py-1.5 text-sm bg-white">
            {SEVERITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div className="w-px h-5 bg-gray-300" />
          <form onSubmit={handleKeywordSearch} className="flex gap-1">
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              placeholder="매장명 / AI요약 검색"
              className="border rounded px-3 py-1.5 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-gray-400 bg-white"
            />
            <button type="submit" className="bg-gray-800 text-white px-3 py-1.5 rounded text-sm hover:bg-gray-700 transition">검색</button>
            {keyword && (
              <button type="button" onClick={() => { setKeyword(''); setKeywordInput('') }} className="border px-2 py-1.5 rounded text-sm text-gray-500 hover:bg-gray-100 bg-white transition">×</button>
            )}
          </form>
          <span className="text-sm text-gray-500 ml-auto font-medium">총 <span className="text-gray-800 font-bold">{total}</span>건</span>
        </div>

      {/* 갤러리 */}
      <div className="overflow-y-auto p-6 flex-1">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">불러오는 중...</div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-gray-400">검색 결과가 없습니다</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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

        {totalPages > 1 && (
          <div className="flex justify-center gap-1 mt-8">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => { setPage(p); fetchData(p) }}
                className={`w-8 h-8 rounded text-sm ${p === page ? 'bg-gray-800 text-white' : 'bg-white border hover:bg-gray-100 text-gray-700'}`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && <Modal item={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}