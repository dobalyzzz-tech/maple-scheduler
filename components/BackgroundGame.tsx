"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

const IDLE_FRAMES = [0, 1, 2, 1];
const IDLE_INTERVAL = 500;
const WALK_INTERVAL = 200;

const SCROLL_SPEED = 4;
const SCROLL_LIMIT = 1500;

const EREB_BG = "/background/ereb.png";
const DEFAULT_BOTTOM = 122;

// 아이템 이름 → 스프라이트 파일명 매핑 (표시 순서대로)
const ITEM_LAYER_MAP: Record<string, string[]> = {
  // body (항상 표시, 아이템 아님)
  body_body: ["body_body.png"],
  body_arm: ["body_arm.png"],
  body_head: ["body_head.png"],
  // hair
  "더벅 머리": ["더벅 머리(모자_미장착)_hair_hair.png", "더벅 머리_hair_hairShade.png", "더벅 머리_hair_hairBelowBody.png"],
  "커닝시티 헤어": ["커닝시티 헤어(모자_미장착)_hair_hair.png", "커닝시티 헤어_hair_hairShade.png"],
  "토벤 머리": ["토벤 머리_hair_hair.png", "토벤 머리_hair_hairShade.png"],
  // face
  "자신있는 얼굴": ["자신있는 얼굴_face_face.png"],
  "도전적인 얼굴": ["도전적인 얼굴_face_face.png"],
  "신중한 얼굴": ["신중한 얼굴_face_face.png"],
  // top
  "주황색 츄리닝 상의": ["주황색 츄리닝 상의_top_mailChest.png", "주황색 츄리닝 상의_top_mailArm.png"],
  "주황색 점퍼": ["주황색 점퍼_top_mailChest.png", "주황색 점퍼_top_mailArm.png"],
  "흰색 셔츠": ["흰색 셔츠_top_mailChest.png", "흰색 셔츠_top_mailArm.png"],
  // bottom
  "주황색 츄리닝 하의": ["주황색 츄리닝 하의_bottom_pantsBelowShoes.png"],
  "청반바지": ["청반바지_bottom_pants.png"],
  "흰색 청바지": ["흰색 청바지_bottom_pants.png"],
  // accessory
  "오렌지색 선글라스": ["오렌지색 선글라스_accessoryEye_accessoryEye.png"],
  "파란색 비니": ["파란색 비니_cap_cap.png", "파란색 비니_cap_capAccessoryBelowBody.png"],
  "하늘색 고글 비니": ["하늘색 고글 비니_cap_cap.png"],
};

// 레이어 표시 우선순위 (낮을수록 먼저 그림)
const LAYER_ORDER: Record<string, number> = {
  body_body: 0,
  bottom_pants: 1,
  bottom_pantsBelowShoes: 1,
  hairBelowBody: 1.5,
  top_mailChest: 2,
  capAccessoryBelowBody: 3,
  body_arm: 4,
  top_mailArm: 5,
  body_head: 6,
  face: 7,
  hairShade: 8,
  hair: 9,
  cap: 10,
  accessoryEye: 11,
};

// 레이어별 top 오프셋 (px)
const LAYER_OFFSET: Record<string, { top?: number; left?: number; w?: number; h?: number }> = {
  "더벅 머리(모자_미장착)_hair_hair.png": { top: 4.5, left: 2.5, w: 80, h: 105 },
  "더벅 머리_hair_hairBelowBody.png": { top: 0 },
};

function layerOrder(filename: string): number {
  for (const [key, order] of Object.entries(LAYER_ORDER)) {
    if (filename.includes(key)) return order;
  }
  return 50;
}

function spritePath(subPath: string, fileName: string) {
  return `/sprites/default/${subPath}/${encodeURIComponent(fileName)}`;
}

export default function BackgroundGame() {
  const [bg, setBg] = useState("/background/mayas_house.png");
  const [loading, setLoading] = useState(true);
  const [frame, setFrame] = useState(0);
  const [charBottom, setCharBottom] = useState(DEFAULT_BOTTOM);
  const [action, setAction] = useState<"idle" | "walk">("idle");
  const [facingLeft, setFacingLeft] = useState(false);
  const [layers, setLayers] = useState<string[]>([]);
  const [equippedItems, setEquippedItems] = useState<string[]>([]);
  const [faceFile, setFaceFile] = useState<string | null>(null);

  const dirRef = useRef(0);
  const bgOffsetRef = useRef(0);
  const limitRef = useRef(1500);
  const bgRef = useRef<HTMLDivElement>(null);
  const animRef = useRef(0);

  useEffect(() => {
    const interval = action === "idle" ? IDLE_INTERVAL : WALK_INTERVAL;
    const frames = action === "idle" ? IDLE_FRAMES : [0, 1, 2, 1];
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % frames.length);
    }, interval);
    return () => clearInterval(timer);
  }, [action]);

  useEffect(() => {
    const loop = () => {
      const dir = dirRef.current;
      const limit = limitRef.current;
      if (dir < 0) {
        bgOffsetRef.current = Math.min(bgOffsetRef.current + SCROLL_SPEED, limit);
      } else if (dir > 0) {
        bgOffsetRef.current = Math.max(bgOffsetRef.current - SCROLL_SPEED, -limit);
      }
      if (bgRef.current) {
        bgRef.current.style.backgroundPosition = `calc(50% + ${bgOffsetRef.current}px) 50%`;
      }
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); dirRef.current = -1; setAction("walk"); setFacingLeft(false); }
      else if (e.key === "ArrowRight") { e.preventDefault(); dirRef.current = 1; setAction("walk"); setFacingLeft(true); }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") { dirRef.current = 0; setAction("idle"); }
    };
    window.addEventListener("keydown", handleKey);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    (async () => {
      await loadEquipment();
    })();
  }, []);

  // 인벤토리 장착/해제 시 다시 로드
  useEffect(() => {
    const handler = () => loadEquipment();
    window.addEventListener("equipment-changed", handler);
    return () => window.removeEventListener("equipment-changed", handler);
  }, []);

  async function loadEquipment() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: inv } = await supabase.from("inventory").select("item_id").eq("user_id", user.id).eq("equipped", true);
      if (inv && inv.length > 0) {
        const { data: items } = await supabase.from("items").select("asset_url, name, category").in("id", inv.map((i: { item_id: string }) => i.item_id));
        const bgItem = items?.find((i: { asset_url: string | null }) => i.asset_url && i.category === "background");
        if (bgItem?.asset_url) {
          setBg(bgItem.asset_url);
          setCharBottom(DEFAULT_BOTTOM);
          limitRef.current = 1500;
          if (bgItem.asset_url === EREB_BG) {
            setCharBottom(DEFAULT_BOTTOM);
            limitRef.current = 800;
          } else if (bgItem.asset_url === "/background/mayas_house.png") {
            setCharBottom(DEFAULT_BOTTOM + 16);
            limitRef.current = 300;
          } else if (bgItem.asset_url === "/background/ludibrium.png") {
            setCharBottom(DEFAULT_BOTTOM + 49);
            limitRef.current = 300;
          } else if (bgItem.asset_url === "/background/ristonia.png") {
            setCharBottom(DEFAULT_BOTTOM - 40);
            limitRef.current = 500;
          }
        }

        const avatarItems = (items ?? [])
          .filter((i: { category: string }) => i.category === "avatar")
          .map((i: { name: string }) => i.name);
        setEquippedItems(avatarItems);
      }
    } catch {}
    setLoading(false);
  }

  // 장착된 아이템 → 레이어 파일 목록 생성
  useEffect(() => {
    const allLayers: string[] = ["body_body.png", "body_arm.png", "body_head.png"];
    const hasCap = equippedItems.some((name) =>
      ["파란색 비니", "하늘색 고글 비니"].includes(name)
    );
    for (const itemName of equippedItems) {
      let files = ITEM_LAYER_MAP[itemName];
      if (files) {
        // cap 장착 시 hair를 모자_장착 버전으로 교체
        if (hasCap && itemName === "더벅 머리") {
          files = files.map((f) =>
            f.includes("모자_미장착") ? f.replace("모자_미장착", "모자_장착") : f
          );
        }
        allLayers.push(...files);
      }
    }
    // 중복 제거 (같은 파일이 여러 아이템에 매핑된 경우)
    const unique = [...new Set(allLayers)];
    setLayers(unique.sort((a, b) => layerOrder(a) - layerOrder(b)));
    setFaceFile(null);
  }, [equippedItems]);

  const subPath = action === "walk" ? `walk1_${frame}` : `stand1_${IDLE_FRAMES[frame]}`;

  return loading ? (
    <div className="flex-1 flex items-center justify-center bg-[#2E353D]">
      <div className="w-8 h-8 border-2 border-[#D1D4D6] border-t-[#44DDDD] rounded-full animate-spin" />
    </div>
  ) : (
    <div className="flex-1 overflow-hidden relative" style={{ backgroundColor: "#2E353D" }}>
      <div ref={bgRef} className="absolute inset-0" style={{ backgroundImage: `url(${bg})`, backgroundSize: "cover", backgroundPosition: "50% 50%", imageRendering: "pixelated" }} />
      <div className="absolute" style={{ bottom: charBottom, left: "calc(50% + 4px)", width: 60, height: 80, transform: `translateX(-50%) scaleX(${facingLeft ? -1 : 1})` }}>
        <div className="relative w-full h-full">
          {layers.map((file) => (
            <img
              key={file}
              src={spritePath(subPath, file)}
              alt=""
              className="absolute"
              style={{ left: `${LAYER_OFFSET[file]?.left ?? 0}px`, right: 0, top: `${LAYER_OFFSET[file]?.top ?? 0}px`, width: `${LAYER_OFFSET[file]?.w ?? 100}%`, height: `${LAYER_OFFSET[file]?.h ?? 100}%`, objectFit: "contain", imageRendering: "pixelated" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ))}
          {faceFile && (
            <img
              src={spritePath(subPath, faceFile)}
              alt=""
              className="absolute"
              style={{ left: 0, right: 0, top: "30px", width: "100%", height: "auto", imageRendering: "pixelated" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
        </div>
      </div>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[9px] font-pixel text-white/60 bg-black/40 px-2 py-0.5 rounded whitespace-nowrap">← → 이동</div>
    </div>
  );
}
