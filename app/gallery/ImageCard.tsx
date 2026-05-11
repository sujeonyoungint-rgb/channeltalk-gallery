'use client'

interface Props {
  item: any
  storeCount: number
  onClick: () => void
}

export default function ImageCard({ item, storeCount, onClick }: Props) {
  const keywords: string[] = item.ai_analysis?.keywords ?? []
  const images: any[] = item.images ?? []
  const firstImage = images[0]
  const subtype = firstImage?.vision_analysis?.subtype ?? ''
  const date = item.chat_created_at
    ? new Date(item.chat_created_at).toLocaleString('ko-KR', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      })
    : ''

  return (
    <div onClick={onClick} className="border rounded-lg overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer">
      {/* 썸네일 그리드 */}
      <div className="relative aspect-square bg-gray-100">
        {images.length === 1 && (
          <img src={images[0].storage_url} className="w-full h-full object-cover" />
        )}
        {images.length === 2 && (
          <div className="grid grid-cols-2 h-full gap-0.5">
            {images.map((img, i) => (
              <img key={i} src={img.storage_url} className="w-full h-full object-cover" />
            ))}
          </div>
        )}
        {images.length >= 3 && (
          <div className="grid grid-cols-2 grid-rows-2 h-full gap-0.5">
            {images.slice(0, 4).map((img, i) => (
              <div key={i} className="relative overflow-hidden">
                <img src={img.storage_url} className="w-full h-full object-cover" />
                {i === 3 && images.length > 4 && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="text-white font-bold text-lg">+{images.length - 4}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {images.length > 1 && (
          <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">
            {images.length}장
          </div>
        )}
      </div>

      <div className="p-3 space-y-1">
        <div className="flex justify-between items-start">
          <p className="font-semibold text-sm truncate">{item.store_name ?? '매장명 없음'}</p>
          {storeCount > 1 && <span className="text-xs text-red-500 shrink-0 ml-1">기간내 {storeCount}건</span>}
        </div>
        <p className="text-xs text-gray-500 truncate">{firstImage?.vision_analysis?.description}</p>
        <div className="flex flex-wrap gap-1 pt-1">
          <span className="text-xs bg-gray-100 rounded px-1.5 py-0.5">{date}</span>
          {subtype && <span className="text-xs bg-blue-50 text-blue-600 rounded px-1.5 py-0.5">{subtype}</span>}
          {keywords.slice(0, 2).map((kw) => (
            <span key={kw} className="text-xs bg-orange-50 text-orange-600 rounded px-1.5 py-0.5">{kw}</span>
          ))}
        </div>
      </div>
    </div>
  )
}