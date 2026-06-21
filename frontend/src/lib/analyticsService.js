import { supabase } from "./supabaseClient";

function cleanKeywordIds(keywordIds) {
  return [...new Set((keywordIds || [])
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0))];
}

function cleanUserIds(userIds) {
  return [...new Set((userIds || [])
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0))];
}

function normalizeAnalytics(data) {
  return {
    totalSearchesDone: Number(data?.totalSearchesDone || 0),
    totalTimesSearched: Number(data?.totalTimesSearched || 0),
    totalProfileViews: Number(data?.totalProfileViews || 0),
    viewers: Array.isArray(data?.viewers) ? data.viewers.map((viewer) => ({
      id: viewer.id,
      viewerUserId: Number(viewer.viewerUserId || 0),
      viewerName: viewer.viewerName || "Member",
      viewerProfileUrl: viewer.viewerProfileUrl || "",
      keywordIds: cleanKeywordIds(viewer.keywordIds),
      keywordNames: Array.isArray(viewer.keywordNames)
        ? viewer.keywordNames.map((name) => String(name || "").trim()).filter(Boolean)
        : [],
      createdAt: viewer.createdAt || null,
    })) : [],
  };
}

export async function getMyProfileAnalytics(limit = 25) {
  const { data, error } = await supabase.rpc("get_my_profile_analytics", {
    p_limit: limit,
  });
  if (error) throw new Error(error.message);

  return normalizeAnalytics(data || {});
}

export async function recordSearchAnalytics(keywordIds, resultUserIds) {
  const ids = cleanKeywordIds(keywordIds);
  if (ids.length === 0) return null;

  const { data, error } = await supabase.rpc("record_search_analytics", {
    p_keyword_ids: ids,
    p_result_user_ids: cleanUserIds(resultUserIds),
  });
  if (error) throw new Error(error.message);

  return data;
}

export async function recordProfileView(viewedUserId, keywordIds = []) {
  const id = Number(viewedUserId);
  if (!Number.isInteger(id) || id <= 0) return false;

  const { data, error } = await supabase.rpc("record_profile_view", {
    p_viewed_user_id: id,
    p_keyword_ids: cleanKeywordIds(keywordIds),
  });
  if (error) throw new Error(error.message);

  return !!data;
}
