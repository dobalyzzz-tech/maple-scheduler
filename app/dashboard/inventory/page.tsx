"use client";

import { useMyInventory, useEquipItem } from "@/lib/queries";

export default function InventoryPage() {
  const { data: inventory } = useMyInventory();
  const equipItem = useEquipItem();

  const avatarItems = inventory?.filter((i) => i.category === "avatar") ?? [];
  const backgroundItems = inventory?.filter((i) => i.category === "background") ?? [];
  const titleItems = inventory?.filter((i) => i.category === "title") ?? [];

  const renderItem = (inv: { item_id: string; equipped: boolean; name: string; category: string; asset_url: string | null }) => (
    <div key={inv.item_id} className="rounded-xl px-4 py-3 bg-[#D1D4D6] flex items-center justify-between">
      <div>
        <div className="font-pixel text-xs text-border">{inv.name}</div>
        <div className="font-pixel text-[10px] text-border/50 mt-1">
          {inv.category === "avatar" ? "아바타" : inv.category === "theme" ? "테마" : inv.category === "background" ? "배경" : "칭호"}
        </div>
      </div>
      <button
        className={`pixel-btn px-3 py-1.5 text-[10px] ${inv.equipped ? "bg-success text-white" : "bg-parchment text-border"}`}
        onClick={() => equipItem.mutate({ itemId: inv.item_id, equipped: !inv.equipped })}
      >
        {inv.equipped ? "착용중" : "착용"}
      </button>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col px-3 pt-0 pb-2 gap-1.5 max-w-4xl mx-auto w-full">
      {/* 아바타 */}
      <div className="rounded-2xl px-6 py-4 bg-[#EEEEEE] border border-[#D1D4D6]">
        <h2 className="font-pixel text-sm text-border mb-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block align-middle mr-1"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          아바타 아이템
        </h2>
        {avatarItems.length === 0 ? (
          <div className="text-border/40 font-pixel text-xs text-center py-6">보유한 아바타 아이템이 없어요</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {avatarItems.map(renderItem)}
          </div>
        )}
      </div>

      {/* 배경 */}
      <div className="rounded-2xl px-6 py-4 bg-[#EEEEEE] border border-[#D1D4D6]">
        <h2 className="font-pixel text-sm text-border mb-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block align-middle mr-1"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          배경
        </h2>
        {backgroundItems.length === 0 ? (
          <div className="text-border/40 font-pixel text-xs text-center py-6">보유한 배경이 없어요</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {backgroundItems.map(renderItem)}
          </div>
        )}
      </div>

      {/* 칭호 */}
      <div className="rounded-2xl px-6 py-4 bg-[#EEEEEE] border border-[#D1D4D6]">
        <h2 className="font-pixel text-sm text-border mb-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block align-middle mr-1"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>
          칭호
        </h2>
        {titleItems.length === 0 ? (
          <div className="text-border/40 font-pixel text-xs text-center py-6">보유한 칭호가 없어요</div>
        ) : (
          <div className="flex flex-col gap-2">
            {titleItems.map(renderItem)}
          </div>
        )}
      </div>
    </div>
  );
}
