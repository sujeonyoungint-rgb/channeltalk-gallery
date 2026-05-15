'use client'
import { useState, useEffect } from 'react'

interface Props {
  item: any
  onClose: () => void
}

// subtype 한글 라벨 매핑 (v7 - payment_proof_for_refund)
const SUBTYPE_LABEL: Record<string, string> = {
  printed_output: '출력물',
  kiosk_screen: '키오스크 화면',
  kiosk_body: '키오스크 본체',
  no_output: '출력 안됨',
  payment_proof_for_refund: '결제 증빙 (영수증)',
  other_defect: '기타 불량',
  original_photo: '원본 사진',
  출력물: '출력물',
  '키오스크 화면': '키오스크 화면',
  '키오스크 본체': '키오스크 본체',
}

// transcript 한 줄 파싱: [시각] [발화자] 내용
interface TranscriptLine {
  time: string
  speaker: 'bot' | 'user' | 'manager' | 'system' | 'unknown'
  content: string
  raw: string
}

function parseTranscript(text: string): TranscriptLine[] {
  if (!text) return []

  const lines = text.split('\n')
  const result: TranscriptLine[] = []
  let currentLine: TranscriptLine | null = null

  // [HH:MM:SS] [speaker] content  또는  [HH:MM:SS] content
  const lineRe = /^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(?:\[([^\]]+)\]\s*)?(.*)$/

  for (const raw of lines) {
    const m = raw.match(lineRe)
    if (m) {
      // 새 발화 시작 → 이전 발화 push
      if (currentLine) result.push(currentLine)

      const time = m[1]
      const speakerRaw = (m[2] ?? '').toLowerCase().trim()
      const content = m[3] ?? ''

      let speaker: TranscriptLine['speaker'] = 'unknown'
      if (speakerRaw.includes('bot')) speaker = 'bot'
      else if (speakerRaw.includes('user') || speakerRaw.includes('고객'))
        speaker = 'user'
      else if (
        speakerRaw.includes('manager') ||
        speakerRaw.includes('agent') ||
        speakerRaw.includes('상담')
      )
        speaker = 'manager'
      else if (speakerRaw.includes('form') || speakerRaw.includes('폼'))
        speaker = 'system'
      // 발화자 명시 안 된 경우: 폼 입력 추정 (한글 키:값 패턴)
      else if (!m[2] && /[가-힣].*[::]/.test(content)) speaker = 'system'

      currentLine = { time, speaker, content, raw }
    } else if (currentLine) {
      // 이어지는 멀티라인 → 현재 발화에 append
      currentLine.content += '\n' + raw
    } else {
      // 첫 줄부터 패턴 안 맞음 → 그냥 unknown으로
      currentLine = { time: '', speaker: 'unknown', content: raw, raw }
    }
  }
  if (currentLine) result.push(currentLine)

  return result
}

const SPEAKER_STYLE: Record<
  TranscriptLine['speaker'],
  { label: string; icon: string; bg: string; text: string; border: string }
> = {
  bot: {
    label: '봇',
    icon: '🤖',
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    border: 'border-gray-200',
  },
  user: {
    label: '고객',
    icon: '👤',
    bg: 'bg-blue-50',
    text: 'text-blue-900',
    border: 'border-blue-200',
  },
  manager: {
    label: '상담사',
    icon: '🧑‍💼',
    bg: 'bg-green-50',
    text: 'text-green-900',
    border: 'border-green-200',
  },
  system: {
    label: '폼/시스템',
    icon: '📝',
    bg: 'bg-yellow-50',
    text: 'text-yellow-900',
    border: 'border-yellow-200',
  },
  unknown: {
    label: '',
    icon: '·',
    bg: 'bg-white',
    text: 'text-gray-600',
    border: 'border-gray-200',
  },
}

export default function Modal({ item, onClose }: Props) {
  const [imgZoom, setImgZoom] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(0)

  const images: any[] = item.images ?? []
  const currentImage = images[currentIdx]
  const tags: string[] = Array.isArray(item.tags) ? item.tags : []

  // v2.1 우선, JSONB fallback
  const severity: string =
    item.ai_severity ?? item.ai_classification?.severity ?? ''
  const defectType: string =
    item.ai_defect_type_main ??
    item.ai_classification?.defect_type_main ??
    item.ai_defect_type ??
    ''
  const isPopupStore: boolean =
    item.ai_is_popup_store ??
    item.ai_extracted_facts?.is_popup_store ??
    false
  const subtypeRaw = currentImage?.vision_analysis?.subtype ?? ''
  const subtype = SUBTYPE_LABEL[subtypeRaw] ?? subtypeRaw
  // images 비어있으면 placeholder (영수증만 있는 chat)
  const hasNoDisplayableImage = images.length === 0
  const isPaymentProofChat = item.has_payment_proof === true

  // 환불 정보 (한 줄 요약)
  const refundFields: string[] = []
  if (item.refund_reason) refundFields.push(`환불사유: ${item.refund_reason}`)
  if (item.payment_date) refundFields.push(`결제일: ${item.payment_date}`)
  if (item.card_company) refundFields.push(`카드사: ${item.card_company}`)
  if (item.card_approval_no)
    refundFields.push(`승인: ${item.card_approval_no}`)
  const hasRefundInfo = refundFields.length > 0

  // transcript 파싱
  const transcriptLines = parseTranscript(item.transcript ?? '')

  const date = item.chat_created_at
    ? new Date(item.chat_created_at).toLocaleString('ko-KR')
    : ''

  const isHighSeverity = severity === 'high'

  // ESC 키로 닫기 + 좌/우 화살표로 이미지 이동
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (imgZoom) setImgZoom(false)
        else onClose()
      } else if (imgZoom && images.length > 1) {
        if (e.key === 'ArrowLeft') {
          setCurrentIdx((i) => (i - 1 + images.length) % images.length)
        } else if (e.key === 'ArrowRight') {
          setCurrentIdx((i) => (i + 1) % images.length)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [imgZoom, images.length, onClose])

  return (
    <>
      {/* 이미지 전체화면 (placeholder는 zoom 안 함) */}
      {imgZoom && !hasNoDisplayableImage && (
        <div
          className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center cursor-zoom-out"
          onClick={() => setImgZoom(false)}
        >
          <img
            src={currentImage?.storage_url}
            className="max-w-full max-h-full object-contain"
            alt=""
          />
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setCurrentIdx((i) => (i - 1 + images.length) % images.length)
                }}
                className="absolute left-4 text-white text-5xl hover:text-gray-300 px-2"
                aria-label="이전 이미지"
              >
                ‹
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setCurrentIdx((i) => (i + 1) % images.length)
                }}
                className="absolute right-4 text-white text-5xl hover:text-gray-300 px-2"
                aria-label="다음 이미지"
              >
                ›
              </button>
              <span className="absolute bottom-4 text-white text-sm bg-black/50 px-3 py-1 rounded-full">
                {currentIdx + 1} / {images.length}
              </span>
            </>
          )}
          <button
            onClick={() => setImgZoom(false)}
            className="absolute top-4 right-4 text-white text-3xl leading-none hover:text-gray-300"
            aria-label="닫기"
          >
            ×
          </button>
        </div>
      )}

      {/* 상세 모달 */}
      <div
        className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 모달 헤더 */}
          <div className="bg-gray-800 px-6 py-4 rounded-t-xl flex justify-between items-center sticky top-0 z-10">
            <div className="min-w-0">
              <h2 className="font-bold text-lg text-white truncate">
                {item.store_name ?? '매장명 없음'}
              </h2>
              <p className="text-gray-400 text-xs mt-0.5">{date}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl leading-none transition shrink-0 ml-3"
              aria-label="닫기"
            >
              ×
            </button>
          </div>

          {/* 사진 영역 */}
          <div className="bg-gray-100 px-6 py-4">
            {hasNoDisplayableImage ? (
              // 표시할 사진 없음 (영수증만 있는 chat) → placeholder
              <div className="w-full bg-gray-50 rounded-lg flex flex-col items-center justify-center py-16 text-gray-500 border-2 border-dashed border-gray-300 relative">
                <div className="text-6xl mb-3">📭</div>
                <div className="text-lg font-semibold text-gray-700">
                  {isPaymentProofChat ? '미출력 환불' : '노출 사진 없음'}
                </div>
                <div className="text-sm mt-1 text-gray-400">
                  {isPaymentProofChat
                    ? '결제 증빙용 영수증만 첨부됨'
                    : '영수증/사용법 사진만 있음'}
                </div>
                {isHighSeverity && (
                  <div
                    className="absolute top-2 left-2 w-3 h-3 bg-red-500 rounded-full ring-2 ring-white shadow"
                    title="시급"
                  />
                )}
              </div>
            ) : (
              <>
                <div
                  className="relative cursor-zoom-in group"
                  onClick={() => setImgZoom(true)}
                >
                  <img
                    src={currentImage?.storage_url}
                    className="w-full rounded-lg object-contain max-h-[60vh] md:max-h-96"
                    alt=""
                  />
                  {isHighSeverity && (
                    <div
                      className="absolute top-2 left-2 w-3 h-3 bg-red-500 rounded-full ring-2 ring-white shadow"
                      title="시급"
                    />
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-lg transition flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 text-white text-sm bg-black/50 px-3 py-1 rounded-full transition">
                      클릭하여 확대
                    </span>
                  </div>
                </div>
                {images.length > 1 && (
                  <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                    {images.map((img, i) => (
                      <img
                        key={i}
                        src={img.storage_url}
                        onClick={() => setCurrentIdx(i)}
                        className={`w-14 h-14 object-cover rounded cursor-pointer shrink-0 border-2 transition ${
                          i === currentIdx
                            ? 'border-blue-400'
                            : 'border-transparent hover:border-gray-300'
                        }`}
                        alt=""
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* 정보 영역 */}
          <div className="px-6 py-4 space-y-3">
            {/* 분류 배지 한 줄 */}
            <div className="flex gap-2 flex-wrap items-center">
              {defectType && (
                <span className="text-xs bg-blue-50 text-blue-700 rounded-full px-3 py-1 font-medium">
                  {defectType}
                </span>
              )}
              {subtype && (
                <span className="text-xs bg-blue-50 text-blue-700 rounded-full px-3 py-1">
                  {subtype}
                </span>
              )}
              {severity && (
                <span
                  className={`text-xs rounded-full px-3 py-1 font-medium ${
                    severity === 'high'
                      ? 'bg-red-50 text-red-600'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {severity === 'high' ? '🔴 시급' : '낮음'}
                </span>
              )}
              {isPopupStore && (
                <span className="text-xs bg-purple-50 text-purple-700 rounded-full px-3 py-1">
                  팝업매장
                </span>
              )}
            </div>

            {/* 환불 정보 한 줄 요약 */}
            <div className="text-xs text-gray-500 border-l-2 border-gray-200 pl-3">
              {hasRefundInfo ? refundFields.join(' · ') : '환불 정보 없음'}
            </div>

            {/* 채널톡 태그 */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="text-xs bg-orange-50 text-orange-700 rounded-full px-2.5 py-1"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}

            {/* AI 요약 */}
            {item.ai_summary && (
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                <p className="text-xs text-blue-500 font-medium mb-1">
                  AI 요약
                </p>
                <p className="text-sm text-gray-800">{item.ai_summary}</p>
              </div>
            )}

            {/* 상담 내용 (발화자 구분) */}
            {transcriptLines.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 font-medium mb-1.5">
                  상담 내용
                </p>
                <div className="bg-white rounded-lg p-2 max-h-80 overflow-y-auto border space-y-1.5">
                  {transcriptLines.map((line, i) => {
                    const style = SPEAKER_STYLE[line.speaker]
                    return (
                      <div
                        key={i}
                        className={`rounded px-2.5 py-1.5 border ${style.bg} ${style.border}`}
                      >
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className="text-xs">{style.icon}</span>
                          {style.label && (
                            <span
                              className={`text-[10px] font-semibold ${style.text}`}
                            >
                              {style.label}
                            </span>
                          )}
                          {line.time && (
                            <span className="text-[10px] text-gray-400">
                              {line.time}
                            </span>
                          )}
                        </div>
                        <pre
                          className={`text-xs whitespace-pre-wrap font-sans ${style.text}`}
                        >
                          {line.content.trim()}
                        </pre>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}