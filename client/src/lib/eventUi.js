import { formatTime12h } from "./time.js";

export function getCategoryTone(tag) {
  const key = String(tag || "").toLowerCase();
  if (key === "tech conference") {
    return "border-red-500/30 bg-[rgba(239,68,68,0.12)] text-red-300";
  }
  if (key === "hackathon") {
    return "border-blue-500/30 bg-[rgba(59,130,246,0.12)] text-blue-300";
  }
  if (key === "social impact") {
    return "border-green-500/30 bg-[rgba(34,197,94,0.12)] text-green-300";
  }
  if (key === "cultural") {
    return "border-orange-500/30 bg-[rgba(249,115,22,0.12)] text-orange-300";
  }
  if (key === "academic") {
    return "border-yellow-500/30 bg-[rgba(234,179,8,0.12)] text-yellow-300";
  }
  if (key === "arts") {
    return "border-pink-500/30 bg-[rgba(236,72,153,0.12)] text-pink-300";
  }
  if (key === "music") {
    return "border-purple-500/30 bg-[rgba(168,85,247,0.12)] text-purple-300";
  }
  if (key === "startup") {
    return "border-amber-700/40 bg-[rgba(180,83,9,0.16)] text-amber-200";
  }
  if (key === "workshop") {
    return "border-cyan-500/30 bg-[rgba(6,182,212,0.12)] text-cyan-300";
  }
  if (key === "other") {
    return "border-slate-500/30 bg-[rgba(100,116,139,0.14)] text-slate-300";
  }
  if (key === "innovation & research") {
    return "border-teal-500/30 bg-[rgba(20,184,166,0.12)] text-teal-300";
  }
  if (key === "academic seminar") {
    return "border-lime-500/30 bg-[rgba(132,204,22,0.12)] text-lime-300";
  }
  if (key === "competition") {
    return "border-rose-500/30 bg-[rgba(244,63,94,0.12)] text-rose-300";
  }
  if (key.includes("sport")) {
    return "border-emerald-500/30 bg-[rgba(16,185,129,0.1)] text-emerald-400";
  }
  if (key.includes("paid event")) {
    return "border-sky-500/30 bg-[rgba(14,165,233,0.12)] text-sky-300";
  }
  if (key.includes("career")) {
    return "border-indigo-500/30 bg-[rgba(99,102,241,0.1)] text-indigo-400";
  }
  if (key.includes("free food")) {
    return "border-green-500/30 bg-[rgba(34,197,94,0.1)] text-green-300";
  }
  return "border-[var(--border2)] bg-[var(--surface2)] text-[var(--text2)]";
}

export function getEventTags(event) {
  const title = `${event?.title || ""} ${event?.description || ""}`.toLowerCase();
  const paymentType = String(event?.paymentType || "").toLowerCase();
  const tags = [];

  if (title.includes("workshop") || title.includes("learn")) {
    tags.push("Workshop");
  }
  if (
    paymentType === "paid" ||
    (!paymentType &&
      (title.includes("paid") ||
        title.includes("ticket") ||
        title.includes("entry fee") ||
        title.includes("registration fee") ||
        title.includes("pass fee")))
  ) {
    tags.push("Paid Event");
  }
  if (title.includes("career") || title.includes("intern")) {
    tags.push("Career");
  }
  if (tags.length === 0) {
    tags.push("Campus");
  }

  return tags.slice(0, 2);
}

export function getRegistrationCloseLabel(event) {
  if (!event?.registrationCloseDate && !event?.registrationCloseTime) {
    return "";
  }

  const date = event.registrationCloseDate || "";
  const formattedCloseTime = formatTime12h(event.registrationCloseTime);
  const time = formattedCloseTime ? ` · ${formattedCloseTime}` : "";
  return `Registration closes ${date}${time}`.trim();
}