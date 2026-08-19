"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, Heart, Minus, X, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Outfit } from "@/src/lib/outfit/engine";
import { cn } from "@/lib/utils";

type OutfitItem = Outfit["items"][number];

type SelectedState = {
  outfitIndex: number;
  itemId: string;
  expanded: boolean;
};

type Reaction = "like" | "dislike" | null;

const FALLBACK_IMAGES = {
  base_layer: "/quiz/q1-minimal.jpg",
  bottom: "/quiz/q3-denim.jpg",
  footwear: "/quiz/q4-mono.jpg",
  outerwear: "/quiz/q1-formal.jpg",
  accessory: "/quiz/q1-bohemian.jpg",
} as const;

function formatRole(role: string) {
  return role.replaceAll("_", " ");
}

function getLookLabel(index: number) {
  return `Look ${index + 1}`;
}

function isRenderableImage(url: string | null): url is string {
  if (!url) return false;
  return !/\.png(\?.*)?$/i.test(url);
}

function getImageUrl(item: OutfitItem) {
  const name = item.display_name.toLowerCase();

  if (/white\s+linen\s+short\s+sleeve|linen/.test(name)) {
    return "/quiz/q3-linen.jpg";
  }

  if (isRenderableImage(item.image_url)) {
    return item.image_url;
  }

  return FALLBACK_IMAGES[item.layer_role] ?? FALLBACK_IMAGES.base_layer;
}

function getCanvasPlacement(role: OutfitItem["layer_role"]) {
  switch (role) {
    case "base_layer":
      return "left-[18%] top-[12%] h-[34%] w-[22%]";
    case "bottom":
      return "left-[42%] top-[8%] h-[70%] w-[30%]";
    case "footwear":
      return "left-[20%] top-[58%] h-[16%] w-[22%]";
    case "outerwear":
      return "left-[68%] top-[14%] h-[32%] w-[20%]";
    case "accessory":
      return "left-[74%] top-[58%] h-[12%] w-[12%]";
    default:
      return "left-[22%] top-[16%] h-[32%] w-[22%]";
  }
}

function getChipTone(role: OutfitItem["layer_role"]) {
  switch (role) {
    case "base_layer":
      return "bg-[#eef0f2] text-[#4f463d]";
    case "bottom":
      return "bg-[#f0ece7] text-[#4f463d]";
    case "footwear":
      return "bg-[#e9ebe8] text-[#4f463d]";
    case "outerwear":
      return "bg-[#f4efe8] text-[#4f463d]";
    default:
      return "bg-[#f3f1ee] text-[#4f463d]";
  }
}

function sortByRole(items: OutfitItem[]) {
  const order: OutfitItem["layer_role"][] = [
    "base_layer",
    "bottom",
    "footwear",
    "outerwear",
    "accessory",
  ];

  return [...items].sort(
    (a, b) => order.indexOf(a.layer_role) - order.indexOf(b.layer_role),
  );
}

function getAlternateItems(
  outfits: Outfit[],
  currentOutfitIndex: number,
  item: OutfitItem,
) {
  const seen = new Set<string>();
  const alternates: OutfitItem[] = [];

  for (const outfit of outfits) {
    if (outfit === outfits[currentOutfitIndex]) continue;
    for (const candidate of outfit.items) {
      if (candidate.layer_role !== item.layer_role) continue;
      if (candidate.id === item.id || seen.has(candidate.id)) continue;
      seen.add(candidate.id);
      alternates.push(candidate);
    }
  }

  return alternates;
}

export default function OutfitRecommendationsShelf({
  outfits,
}: {
  outfits: Outfit[];
}) {
  const feedRef = useRef<HTMLDivElement | null>(null);
  const [activeOutfitIndex, setActiveOutfitIndex] = useState(0);
  const [selected, setSelected] = useState<SelectedState | null>(null);
  const [reactions, setReactions] = useState<Record<string, Reaction>>({});
  const [swappedItems, setSwappedItems] = useState<Record<string, OutfitItem>>(
    {},
  );

  const displayedOutfits = useMemo(() => {
    return outfits.map((outfit, outfitIndex) => {
      const items = outfit.items.map((item) => {
        const override = swappedItems[`${outfitIndex}:${item.layer_role}`];
        return override ?? item;
      });

      return { ...outfit, items: sortByRole(items) };
    });
  }, [outfits, swappedItems]);

  const selectedItem =
    selected &&
    displayedOutfits[selected.outfitIndex]?.items.find(
      (item) => item.id === selected.itemId,
    );

  const focusedItem = selectedItem ?? null;
  const alternates = focusedItem
    ? getAlternateItems(
        displayedOutfits,
        selected?.outfitIndex ?? activeOutfitIndex,
        focusedItem,
      )
    : [];

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelected(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const selectItem = (outfitIndex: number, itemId: string) => {
    setActiveOutfitIndex(outfitIndex);
    setSelected({ outfitIndex, itemId, expanded: false });
  };

  const closeDrawer = () => setSelected(null);

  const toggleView = () => {
    if (!selected) return;
    setSelected((current) =>
      current ? { ...current, expanded: !current.expanded } : current,
    );
  };

  const swapOut = () => {
    if (!selected || !focusedItem) return;

    const options = getAlternateItems(
      displayedOutfits,
      selected.outfitIndex,
      focusedItem,
    );
    if (options.length === 0) return;

    const currentIndex = options.findIndex(
      (item) => item.id === focusedItem.id,
    );
    const nextItem = options[(currentIndex + 1) % options.length];

    setSwappedItems((current) => ({
      ...current,
      [`${selected.outfitIndex}:${focusedItem.layer_role}`]: nextItem,
    }));
    setSelected({
      outfitIndex: selected.outfitIndex,
      itemId: nextItem.id,
      expanded: true,
    });
  };

  const setReaction = (outfitIndex: number, value: Reaction) => {
    const key = `${outfitIndex}`;
    setReactions((current) => ({
      ...current,
      [key]: current[key] === value ? null : value,
    }));
  };

  if (outfits.length === 0) {
    return (
      <main className="min-h-screen bg-[#f7f4ef] px-4 py-10 text-[#1d1b18] sm:px-6">
        <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center text-center">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#7a6f62]">
            Recommendations
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Add a few more wardrobe pieces.
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#6d6257]">
            I need at least a base layer, bottom, and footwear before I can
            build a useful feed.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f4ef] px-4 py-6 text-[#1d1b18] sm:px-6 lg:py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#7a6f62]">
              Recommendations
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
              Your outfits feed
            </h1>
          </div>
          <Badge
            variant="outline"
            className="border-[#b9aa99] bg-white/45 text-[#4f463d]"
          >
            {outfits.length} looks
          </Badge>
        </div>

        <div className="lg:pr-[392px]">
          <div ref={feedRef} className="space-y-5 pb-4">
            {displayedOutfits.map((outfit, outfitIndex) => {
              const isActive = outfitIndex === activeOutfitIndex;
              const reaction = reactions[String(outfitIndex)] ?? null;

              return (
                <Card
                  key={outfit.items.map((item) => item.id).join("|")}
                  className={cn(
                    "overflow-hidden rounded-lg border bg-white/80 shadow-sm transition-all",
                    isActive
                      ? "border-[#c9b9a8] bg-white shadow-md"
                      : "border-[#e4dbd0] hover:border-[#c9b9a8]",
                  )}
                >
                  <CardHeader className="flex-row items-center justify-between gap-3 border-b border-[#e4dbd0] px-5 py-4">
                    <div>
                      <CardTitle className="text-lg">
                        {getLookLabel(outfitIndex)}
                      </CardTitle>
                      <p className="mt-1 text-xs text-[#6d6257]">
                        {Math.round(outfit.score * 100)}% match
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-[#d8cec2] bg-white text-[#4f463d]"
                    >
                      {outfit.items.length} pieces
                    </Badge>
                  </CardHeader>

                  <CardContent className="space-y-4 p-5">
                    <div className="relative h-[280px] rounded-2xl bg-[#f5f1ec]">
                      {outfit.items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => selectItem(outfitIndex, item.id)}
                          className={cn(
                            "absolute overflow-hidden rounded-xl outline-none transition-transform duration-200 hover:scale-[1.02]",
                            getCanvasPlacement(item.layer_role),
                            selected?.outfitIndex === outfitIndex &&
                              selected.itemId === item.id
                              ? "ring-2 ring-[#4f463d]/30"
                              : "",
                          )}
                          aria-label={`Open ${item.display_name}`}
                        >
                          <div className="relative h-full w-full">
                            <Image
                              src={getImageUrl(item)}
                              alt={item.display_name}
                              fill
                              unoptimized
                              sizes="(min-width: 1024px) 320px, 90vw"
                              className={cn(
                                "object-contain object-center",
                                item.layer_role === "bottom"
                                  ? "scale-[0.98]"
                                  : "scale-100",
                              )}
                            />
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="border-[#d8cec2] bg-white text-[#4f463d]"
                        >
                          Tap a piece
                        </Badge>
                        {reaction && (
                          <Badge
                            variant="outline"
                            className="border-[#d8cec2] bg-white text-[#4f463d]"
                          >
                            {reaction === "like" ? "Liked" : "Skipped"}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setReaction(outfitIndex, "like")}
                          className={cn(
                            "flex h-9 items-center gap-2 rounded-full border px-4 text-sm transition-colors",
                            reaction === "like"
                              ? "border-[#4f463d] bg-[#4f463d] text-white"
                              : "border-[#d8cec2] bg-white text-[#4f463d] hover:bg-[#fbfaf7]",
                          )}
                        >
                          <Heart className="size-4" />
                          Like
                        </button>
                        <button
                          type="button"
                          onClick={() => setReaction(outfitIndex, "dislike")}
                          className={cn(
                            "flex h-9 items-center gap-2 rounded-full border px-4 text-sm transition-colors",
                            reaction === "dislike"
                              ? "border-[#4f463d] bg-[#4f463d] text-white"
                              : "border-[#d8cec2] bg-white text-[#4f463d] hover:bg-[#fbfaf7]",
                          )}
                        >
                          <Minus className="size-4" />
                          Skip
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <AnimatePresence>
          {focusedItem && (
            <motion.aside
              key={`${selected?.outfitIndex ?? activeOutfitIndex}:${focusedItem.id}`}
              initial={{ opacity: 0, x: 28, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 28, scale: 0.98 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="fixed right-4 top-4 z-50 hidden h-[calc(100vh-2rem)] w-[360px] lg:block"
            >
              <Card className="flex h-full flex-col overflow-hidden rounded-lg border-[#d8cec2] bg-white/95 shadow-2xl shadow-black/10 backdrop-blur">
                <CardHeader className="border-b border-[#e4dbd0] px-5 py-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">
                        {focusedItem.display_name}
                      </CardTitle>
                      <p className="mt-1 text-xs text-[#7a6f62]">
                        {getLookLabel(
                          selected?.outfitIndex ?? activeOutfitIndex,
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "border-transparent",
                          getChipTone(focusedItem.layer_role),
                        )}
                      >
                        {formatRole(focusedItem.layer_role)}
                      </Badge>
                      <button
                        type="button"
                        onClick={closeDrawer}
                        className="flex size-8 items-center justify-center rounded-full border border-[#d8cec2] bg-white text-[#4f463d] hover:bg-[#fbfaf7]"
                        aria-label="Close details"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col gap-4 p-5">
                  <div className="relative overflow-hidden rounded-2xl border border-[#e4dbd0] bg-[#fbfaf7]">
                    <div
                      className={cn(
                        "relative w-full transition-all duration-300",
                        selected?.expanded ? "aspect-[4/5]" : "aspect-square",
                      )}
                    >
                      <Image
                        src={getImageUrl(focusedItem)}
                        alt={focusedItem.display_name}
                        fill
                        unoptimized
                        sizes="360px"
                        className="object-contain object-center"
                      />
                    </div>
                  </div>

                  <p className="text-sm leading-6 text-[#6d6257]">
                    {alternates.length > 0
                      ? "Swap this item for another wardrobe match in the same slot."
                      : "No alternate matches available in this slot yet."}
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 rounded-full border-[#b9aa99] bg-white/70 text-[#4f463d] hover:bg-white"
                      onClick={toggleView}
                    >
                      View
                      <ExternalLink className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      className="h-11 rounded-full"
                      onClick={swapOut}
                      disabled={alternates.length === 0}
                    >
                      Swap out
                      <RotateCcw className="size-4" />
                    </Button>
                  </div>

                  <div className="rounded-2xl border border-[#e4dbd0] bg-[#fbfaf7] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#7a6f62]">
                      Alternates
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {alternates.slice(0, 5).map((item) => (
                        <Badge
                          key={item.id}
                          variant="outline"
                          className="border-[#d8cec2] bg-white text-[#4f463d]"
                        >
                          {item.display_name}
                        </Badge>
                      ))}
                      {alternates.length === 0 && (
                        <span className="text-sm text-[#6d6257]">
                          No alternate matches yet.
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.aside>
          )}
        </AnimatePresence>

        <div className="mt-5 lg:hidden">
          {focusedItem && (
            <Card className="overflow-hidden rounded-lg border-[#d8cec2] bg-white/95 shadow-sm">
              <CardHeader className="border-b border-[#e4dbd0] px-5 py-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">
                      {focusedItem.display_name}
                    </CardTitle>
                    <p className="mt-1 text-xs text-[#7a6f62]">
                      {getLookLabel(selected?.outfitIndex ?? activeOutfitIndex)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeDrawer}
                    className="flex size-8 items-center justify-center rounded-full border border-[#d8cec2] bg-white text-[#4f463d]"
                    aria-label="Close details"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-5">
                <div className="relative aspect-square overflow-hidden rounded-2xl border border-[#e4dbd0] bg-[#fbfaf7]">
                  <Image
                    src={getImageUrl(focusedItem)}
                    alt={focusedItem.display_name}
                    fill
                    unoptimized
                    sizes="100vw"
                    className="object-contain object-center"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-full border-[#b9aa99] bg-white/70 text-[#4f463d] hover:bg-white"
                    onClick={toggleView}
                  >
                    View
                    <ExternalLink className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    className="h-11 rounded-full"
                    onClick={swapOut}
                    disabled={alternates.length === 0}
                  >
                    Swap out
                    <RotateCcw className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
