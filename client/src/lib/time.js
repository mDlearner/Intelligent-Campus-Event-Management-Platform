const TIME_24H_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function formatTime12h(timeValue) {
  const raw = String(timeValue || "").trim();
  if (!raw) {
    return "";
  }

  const [candidate] = raw.split(":").length >= 2 ? [raw.slice(0, 5)] : [raw];
  if (!TIME_24H_REGEX.test(candidate)) {
    return raw;
  }

  const [hours24, minutes] = candidate.split(":").map(Number);
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function formatTimeRange12h(startTime, endTime) {
  const start = formatTime12h(startTime);
  const end = formatTime12h(endTime);

  if (start && end) {
    return `${start} - ${end}`;
  }

  return start || end;
}
