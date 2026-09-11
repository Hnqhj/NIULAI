const GROUP_LABELS = Object.freeze({
  official: "正式资产",
  review: "待确认",
  noise: "干扰项",
});

export const ASSET_GROUPS = Object.freeze({
  "": "全部分组",
  ...GROUP_LABELS,
});

const REVIEW_STATUSES = new Set(["待用戶判断", "待用户判断", "暂存", "未评估", "参考可用", "局部可用"]);
const DROP_STATUSES = new Set(["丢弃", "不通过"]);
const OFFICIAL_STATUSES = new Set(["可用", "可用但需优化"]);

function text(value) {
  return String(value ?? "").trim();
}

function normalizedPath(asset) {
  return text(`${asset?.caseId || ""}/${asset?.caseRelPath || ""}/${asset?.relPath || ""}/${asset?.name || ""}`)
    .replaceAll("\\", "/")
    .replace(/\/+/g, "/");
}

function includesAny(value, words) {
  return words.some((word) => value.includes(word));
}

function pathCategory(asset) {
  const original = normalizedPath(asset);
  const lower = original.toLowerCase();
  const kind = text(asset?.kind).toLowerCase();

  if (
    kind === "contact" || kind === "frame" ||
    includesAny(original, ["反推", "抽帧", "拆帧", "视频学习", "contact_sheet", "逐帧"]) ||
    includesAny(lower, ["/frames/", "/frame_extract", "/reverse", "/storyboard_reverse", "/video_reverse", "frame_", "contact_sheet"])
  ) return "reverse";

  if (kind === "audio") return "audio";

  if (
    includesAny(lower, ["/input/", "/inputs/", "/source/", "/sources/", "/reference/", "/references/", "/refs/", "/samples/", "/raw/"]) ||
    includesAny(original, ["原始素材", "输入参考", "参考素材", "外部参考", "源素材"]) ||
    includesAny(lower, ["source_", "input_", "ref_", "_ref."])
  ) return "reference";

  if (
    kind === "video" ||
    includesAny(lower, ["/videos/", "/video_results/", "/video-result/", "/final_videos/", "/exports/", "/renders/", "/rendered/"]) ||
    includesAny(original, ["成片", "视频结果", "最终视频", "可用版", "实测"]) ||
    includesAny(lower, ["seedance", "dreamina", "higgsfield"])
  ) return "videoResult";

  if (
    includesAny(lower, ["/generated_covers/", "/generated/", "/generations/", "/outputs/", "/output/", "/assets/", "/images/", "/covers/", "/candidates/"]) ||
    includesAny(original, ["母版", "机制母版", "首帧", "尾帧", "角色卡", "设定", "候选", "测试图", "资产图", "封面", "道具", "场景"]) ||
    includesAny(lower, ["generated", "candidate", "cover", "final", "regen", "character_design"]) ||
    kind === "image"
  ) return "generatedAsset";

  return "generatedAsset";
}

function statusOf(asset) {
  return text(asset?.userStatus || asset?.initialStatus);
}

function inferredGroup(asset) {
  const explicit = text(asset?.smartGroup).toLowerCase();
  if (Object.hasOwn(GROUP_LABELS, explicit)) {
    return { group: explicit, source: "资产元数据", confidence: "高", reason: "沿用资产已有的分组标记" };
  }

  const path = normalizedPath(asset).toLowerCase();
  const name = text(asset?.name).toLowerCase();
  const status = statusOf(asset);
  if (
    DROP_STATUSES.has(status) ||
    includesAny(`${path} ${name}`, ["/tmp/", "/temp/", "/cache/", "/debug/", "thumbnail", "thumb_", "preview_", "copy (", "副本", "测试废片"])
  ) {
    return { group: "noise", source: "路径与文件名", confidence: "高", reason: "检测到临时、缓存、预览或明确丢弃标记" };
  }

  if (REVIEW_STATUSES.has(status) || status === "" || asset?.reviewStatus === "needs-review") {
    const category = pathCategory(asset);
    if (category === "reference" || category === "reverse" || category === "audio" || status === "") {
      return { group: "review", source: "状态与资源用途", confidence: status ? "高" : "中", reason: status ? "资产仍处于待确认或暂存状态" : "缺少明确的定稿状态，保留人工确认" };
    }
  }

  if (OFFICIAL_STATUSES.has(status) || ["video", "image"].includes(text(asset?.kind).toLowerCase())) {
    return { group: "official", source: "状态与资源类型", confidence: OFFICIAL_STATUSES.has(status) ? "高" : "中", reason: OFFICIAL_STATUSES.has(status) ? "资产状态标记为可用" : "媒体资产可直接进入正式资产候选层" };
  }

  return { group: "review", source: "默认人工复核", confidence: "中", reason: "缺少足够的定稿依据，避免误归入正式资产" };
}

export function classifyAsset(asset = {}) {
  const result = inferredGroup(asset);
  return {
    ...result,
    label: GROUP_LABELS[result.group] || GROUP_LABELS.review,
  };
}
