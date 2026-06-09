const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY || "";
const GIPHY_API_BASE_URL = "https://api.giphy.com/v1/gifs";

function getGifImage(gif, keys) {
  for (const key of keys) {
    const image = gif?.images?.[key];
    if (image?.url) return image;
  }

  return null;
}

function mapGiphyGif(gif) {
  const image = getGifImage(gif, ["fixed_height", "downsized_medium", "original"]);
  const preview = getGifImage(gif, ["fixed_width_small", "fixed_height_small", "preview_gif"]);

  if (!gif?.id || !image?.url) return null;

  return {
    id: gif.id,
    title: gif.title || "GIF",
    url: image.url,
    previewUrl: preview?.url || image.url,
  };
}

export function hasGifSearchApiKey() {
  return Boolean(GIPHY_API_KEY.trim());
}

export async function searchGifs(query) {
  if (!hasGifSearchApiKey()) {
    throw new Error("GIF search needs VITE_GIPHY_API_KEY.");
  }

  const trimmedQuery = String(query || "").trim().slice(0, 50);
  const endpoint = trimmedQuery ? "search" : "trending";
  const params = new URLSearchParams({
    api_key: GIPHY_API_KEY,
    limit: "12",
    rating: "pg-13",
    bundle: "messaging_non_clips",
  });

  if (trimmedQuery) {
    params.set("q", trimmedQuery);
  }

  const response = await fetch(`${GIPHY_API_BASE_URL}/${endpoint}?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to load GIFs.");
  }

  const payload = await response.json();
  return (payload.data || []).map(mapGiphyGif).filter(Boolean);
}
