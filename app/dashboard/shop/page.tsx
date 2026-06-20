"use client";

import { useShopItems, useMyInventory, useBuyItem } from "@/lib/queries";
import { useCharacterStore } from "@/store/useCharacterStore";
import { useState } from "react";

export default function ShopPage() {
  const { coins } = useCharacterStore();
  const { data: items, isLoading } = useShopItems();
  const { data: inventory } = useMyInventory();
  const buyItem = useBuyItem();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const hasItem = (itemId: string) => inventory?.some((i) => i.item_id === itemId) ?? false;

  const handleBuy = async (itemId: string, name: string, price: number) => {
    setError(null);
    if (coins < price) { setError("코인이 부족해요!"); return; }
    try {
      await buyItem.mutateAsync(itemId);
      setSuccess(`${name}을(를) 구매했어요!`);
      setTimeout(() => setSuccess(null), 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "구매 실패");
    }
  };

  return (
    <div className="flex-1 flex flex-col px-3 pt-0 pb-2 gap-1.5 max-w-4xl mx-auto w-full">
      {/* 현재 코인 */}
      <div className="rounded-2xl px-6 py-4 flex items-center justify-between bg-[#EEEEEE] border border-[#D1D4D6]">
        <span className="font-pixel text-sm text-border">
          🪙 보유 코인
        </span>
        <span className="font-pixel text-lg text-maple">{coins}</span>
      </div>

      {/* 에러/성공 메시지 */}
      {error && <div className="text-danger font-pixel text-xs text-center">{error}</div>}
      {success && <div className="text-success font-pixel text-xs text-center">{success}</div>}

      {/* 상점 목록 */}
      <div className="rounded-2xl px-6 py-4 bg-[#EEEEEE] border border-[#D1D4D6] min-h-[450px]">
        <h2 className="font-pixel text-sm text-border mb-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block align-middle mr-1"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          아이템 상점
        </h2>
        {isLoading ? (
          <div className="text-border/40 font-pixel text-xs text-center py-6">불러오는 중...</div>
        ) : !items || items.length === 0 ? (
          <div className="text-border/40 font-pixel text-xs text-center py-6">상품이 없어요</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {items.map((item) => {
              const owned = hasItem(item.id);
              return (
                <div key={item.id} className="rounded-xl px-4 py-3 bg-[#D1D4D6] flex items-center justify-between">
                  <div>
                    <div className="font-pixel text-xs text-border">{item.name}</div>
                    <div className="font-pixel text-[10px] text-border/50 mt-1">
                      {item.category === "avatar" ? "아바타" : item.category === "theme" ? "테마" : item.category === "background" ? "배경" : "칭호"}
                      <span className="ml-2">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-block align-middle mr-0.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v12"/><path d="M8 10c0-1.1.9-2 2-2h4a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-4a2 2 0 0 0-2 2v0a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2"/></svg>
                        {item.price}
                      </span>
                    </div>
                  </div>
                  {owned ? (
                    <span className="font-pixel text-[10px] text-success">보유중</span>
                  ) : (
                    <button
                      className="pixel-btn px-3 py-1.5 text-[10px]"
                      onClick={() => handleBuy(item.id, item.name, item.price)}
                      disabled={buyItem.isPending}
                    >
                      구매
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
