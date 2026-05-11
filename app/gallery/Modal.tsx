'use client'
import { useState } from 'react'

interface Props {
  item: any
  onClose: () => void
}

export default function Modal({ item, onClose }: Props) {
  const [imgZoom, setImgZoom] = useState(false)
  const [currentIdx, setCurrentIdx] = useState(0)
  const keywords: string[] = item.ai_analysis?.keywords ?? []
  const tags: string[] = item.tags ?? []
  const images: any[] = item.images ?? []
  const currentImage = images[currentIdx]
  const date = item.chat_created_at
    ? new Date(item.chat_created_at).toLocaleString('ko-KR')
    : ''

  return (
    <>
      {/* 이미지 전체화면 */}
      {imgZoom && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center cursor-zoom-out" onClick={() => setImgZoom(false)}>
          <img src={currentImage?.storage_url} className="max-w-full max-h-full object-contain" />
          {images.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); setCurrentIdx((i) => (i - 1 + images.length) % images.length) }}
                className="absolute left-4 text-white text-5xl hover:text-gray-300 px-2">‹</button>
              <button onClick={(e) => { e.stopPropagation(); setCurrentIdx((i) => (i + 1) % images.length) }}
                className="absolute right-4 text-white text-5xl hover:text-gray-300 px-2">›</button>
              <span className="absolute bottom-4 text-white text-sm bg-black/50 px-3 py-1 rounded-full">
                {currentIdx + 1} / {images.length}
              </span>
            </>
          )}
          <button onClick={() => setImgZoom(false)} className="absolute top-4 right-4 text-white text-3xl leading-none hover:text-gray-300">×</button>
        </div>
      )}

      {/* 상세 모달 */}
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>

          {/* 모달 헤더 */}
          <div className="bg-gray-800 px-6 py-4 rounded-t-xl flex justify-between items-center">
            <div>
              <h2 className="font-bold text-lg text-white">{item.store_name ?? '매장명 없음'}</h2>
              <p className="text-gray-400 text-xs mt-0.5">{date}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none transition">×</button>
          </div>

          {/* 사진 영역 */}
          <div className="bg-gray-100 px-6 py-4">
            <div className="relative cursor-zoom-in group" onClick={() => setImgZoom(true)}>
              <img src={currentImage?.storage_url} className="w-full rounded-lg object-contain max-h-80" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-lg transition flex items-center justify-center">
                <span className="opacity-0 group-hover:opacity-100 text-white text-sm bg-black/50 px-3 py-1 rounded-full transition">클릭하여 확대</span>
              </div>
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                {images.map((img, i) => (
                  <img
                    key={i}
                    src={img.storage_url}
                    onClick={() => setCurrentIdx(i)}
                    className={`w-14 h-14 object-cover rounded cursor-pointer shrink-0 border-2 transition ${i === currentIdx ? 'border-blue-400' : 'border-transparent hover:border-gray-300'}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 정보 영역 */}
          <div className="px-6 py-4 space-y-3">
            {/* 태그/심각도 */}
            <div className="flex gap-2 flex-wrap">
              {item.ai_defect_type && <span className="text-xs bg-blue-50 text-blue-600 rounded-full px-3 py-1 font-medium">{item.ai_defect_type}</span>}
              {item.ai_severity && (
                <span className={`text-xs rounded-full px-3 py-1 font-medium ${
                  item.ai_severity === 'high' ? 'bg-red-50 text-red-500' :
                  item.ai_severity === 'medium' ? 'bg-yellow-50 text-yellow-600' :
                  'bg-green-50 text-green-600'
                }`}>심각도: {item.ai_severity}</span>
              )}
              {tags.map((t) => <span key={t} className="text-xs bg-orange-50 text-orange-600 rounded-full px-3 py-1">{t}</span>)}
            </div>

            {/* AI 요약 */}
            {item.ai_summary && (
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                <p className="text-xs text-blue-400 font-medium mb-1">AI 요약</p>
                <p className="text-sm text-gray-700">{item.ai_summary}</p>
              </div>
            )}

            {/* 키워드 */}
            {keywords.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 font-medium mb-1.5">키워드</p>
                <div className="flex flex-wrap gap-1">
                  {keywords.map((kw) => <span key={kw} className="text-xs bg-yellow-50 text-yellow-700 rounded-full px-2.5 py-1">{kw}</span>)}
                </div>
              </div>
            )}

            {/* 상담 내용 */}
            {item.transcript && (
              <div>
                <p className="text-xs text-gray-400 font-medium mb-1.5">상담 내용</p>
                <div className="bg-gray-50 rounded-lg p-3 max-h-60 overflow-y-auto border">
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans">{item.transcript}</pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}