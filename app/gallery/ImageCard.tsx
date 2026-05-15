'use client'

interface Props {
  item: any
  storeCount: number
  onClick: () => void
}

// subtype 한글 라벨 매핑 (v7 - payment_proof_for_refund 추가)
const SUBTYPE_LABEL: Record<string, string> = {
  printed_output: '출력물',
  kiosk_screen: '키오스크 화면',
  kiosk_body: '키오스크 본체',
  no_output: '출력 안됨',
  payment_proof_for_refund: '결제 증빙 (영수증)',
  other_defect: '기타 불량',
  original_photo: '원본 사진',
  // 한글로 이미 저장된 케이스도 자기 자신으로
  출력물: '출력물',
  '키오스크 화면': '키오스크 화면',
  '키오스크 본체': '키오스크 본체',
}

export default function ImageCard({ item, storeCount, onClick }: Props) {
  // 안전 guard: item 자체가 없으면 아무것도 안 그림
  if (!item) return null

  const images: any[] = item.images ?? []
  const firstImage = images[0]
  const rawSubtype: string = firstImage?.vision_analysis?.subtype ?? ''
  const subtype = SUBTYPE_LABEL[rawSubtype] ?? rawSubtype
  // images가 비어있으면 placeholder (view에서 영수증/사용법 사진 제외 후 빈 케이스)
  const hasNoDisplayableImage = images.length === 0
  // 영수증만 있는 chat인지 (view의 has_payment_proof 컬럼)
  const isPaymentProofChat = item.has_payment_proof === true

  // v2.1 별도 컬럼 우선, 없으면 JSONB fallback
  const severity: string =
    item.ai_severity ?? item.ai_classification?.severity ?? ''
  const isPopupStore: boolean =
    item.ai_is_popup_store ??
    item.ai_extracted_facts?.is_popup_store ??
    false
  const defectType: string =
    item.ai_defect_type_main ??
    item.ai_classification?.defect_type_main ??
    item.ai_defect_type ??
    ''

  const isHighSeverity = severity === 'high'

  const date = item.chat_created_at
    ? new Date(item.chat_created_at).toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''

  return (
    <div
      onClick={onClick}
      className="border rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col"
    >
      {/* 썸네일 그리드 — 장수별 레이아웃 */}
      <div className="relative aspect-square bg-gray-100 shrink-0 rounded-t-lg overflow-hidden">
        {hasNoDisplayableImage ? (
          // 표시할 사진 없음 (영수증만/사용법만 있는 chat) → placeholder
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 bg-gray-50">
            <div className="text-5xl mb-2">📭</div>
            <div className="text-sm font-semibold text-gray-700">
              {isPaymentProofChat ? '미출력 환불' : '노출 사진 없음'}
            </div>
            <div className="text-xs mt-1 text-gray-400">
              {isPaymentProofChat ? '영수증만 첨부됨' : '영수증/사용법 사진만 있음'}
            </div>
          </div>
        ) : (
          <>
            {images.length === 1 && (
              <img
                src={images[0].storage_url}
                className="w-full h-full object-cover"
                alt=""
              />
            )}

            {images.length === 2 && (
              <div className="grid grid-cols-2 h-full gap-0.5">
                {images.map((img, i) => (
                  <img
                    key={i}
                    src={img.storage_url}
                    className="w-full h-full object-cover"
                    alt=""
                  />
                ))}
              </div>
            )}

            {images.length >= 3 && (
              <div className="grid grid-cols-2 grid-rows-2 h-full gap-0.5">
                {images.slice(0, 4).map((img, i) => (
                  <div key={i} className="relative overflow-hidden">
                    <img
                      src={img.storage_url}
                      className="w-full h-full object-cover"
                      alt=""
                    />
                    {i === 3 && images.length > 4 && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="text-white font-bold text-lg">
                          +{images.length - 4}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* severity high 시각화 */}
        {isHighSeverity && (
          <div
            className="absolute top-2 left-2 w-3 h-3 bg-red-500 rounded-full ring-2 ring-white shadow z-10"
            title="시급"
          />
        )}

        {/* 이미지 개수 (placeholder가 아닐 때만) */}
        {!hasNoDisplayableImage && images.length > 1 && (
          <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded z-10">
            {images.length}장
          </div>
        )}

        {/* 영수증 있음 표시 (사진과 영수증 둘 다 있는 chat) */}
        {!hasNoDisplayableImage && isPaymentProofChat && (
          <div className="absolute bottom-2 right-2 bg-yellow-50 text-yellow-700 border border-yellow-200 text-xs px-1.5 py-0.5 rounded z-10">
            💳 영수증 첨부
          </div>
        )}
      </div>

      <div className="p-3 space-y-1">
        {/* 상단: 매장명 · 환불사유 / 매장 반복 카운트 */}
        <div className="flex justify-between items-start gap-2 w-full">
          <p className="font-semibold text-sm min-w-0 flex-1 overflow-hidden whitespace-nowrap text-ellipsis">
            {item.store_name ?? '매장명 없음'}
            {item.refund_reason && (
              <span className="text-gray-500 font-normal">
                {' · '}
                {item.refund_reason}
              </span>
            )}
          </p>
          {storeCount > 1 && (
            <span className="text-xs text-red-500 shrink-0">
              기간내 {storeCount}건
            </span>
          )}
        </div>

        {/* description (placeholder가 아닐 때 첫 사진 description) */}
        <p className="text-xs text-gray-500 min-h-[16px] overflow-hidden whitespace-nowrap text-ellipsis">
          {hasNoDisplayableImage
            ? '결제 증빙용 영수증만 첨부된 환불 케이스'
            : firstImage?.vision_analysis?.description ?? ''}
        </p>

        {/* 메타 배지 한 줄: 날짜 · subtype · defect_type · 팝업 */}
        <div className="flex flex-wrap gap-1 pt-1">
          {date && (
            <span className="text-xs bg-gray-100 text-gray-700 rounded px-1.5 py-0.5">
              {date}
            </span>
          )}
          {subtype && !hasNoDisplayableImage && (
            <span className="text-xs bg-blue-50 text-blue-700 rounded px-1.5 py-0.5">
              {subtype}
            </span>
          )}
          {defectType && !subtype && !hasNoDisplayableImage && (
            <span className="text-xs bg-blue-50 text-blue-700 rounded px-1.5 py-0.5">
              {defectType}
            </span>
          )}
          {isPopupStore && (
            <span className="text-xs bg-purple-50 text-purple-700 rounded px-1.5 py-0.5">
              팝업
            </span>
          )}
        </div>
      </div>
    </div>
  )
}