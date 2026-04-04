const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_24H_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

function formatDateKey(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(dateValue, options = {}) {
  const parsed = parseDateValue(dateValue);
  if (!parsed) {
    return String(dateValue || "").trim();
  }

  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: options.includeYear ? "numeric" : undefined
  });
}

function parseDateValue(dateValue) {
  if (!DATE_REGEX.test(dateValue || "")) {
    return null;
  }

  const [year, month, day] = String(dateValue).split("-").map(Number);
  const parsed = new Date(year, month - 1, day, 0, 0, 0, 0);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function parseTimeValue(timeValue) {
  if (!TIME_24H_REGEX.test(timeValue || "")) {
    return null;
  }

  const [hours, minutes] = String(timeValue).split(":").map(Number);
  return { hours, minutes };
}

export function getNextDateValue(dateValue) {
  const parsed = parseDateValue(dateValue);
  if (!parsed) {
    return "";
  }

  parsed.setDate(parsed.getDate() + 1);
  return formatDateKey(parsed);
}

export function resolveEventEndDate(dateValue, startTime, endDateValue, endTime) {
  if (endDateValue && DATE_REGEX.test(endDateValue)) {
    return endDateValue;
  }

  if (!DATE_REGEX.test(dateValue || "") || !TIME_24H_REGEX.test(startTime || "") || !TIME_24H_REGEX.test(endTime || "")) {
    return endDateValue || "";
  }

  return endTime <= startTime ? getNextDateValue(dateValue) : dateValue;
}

export function getEventDateTimeSpan(dateValue, startTime, endDateValue, endTime) {
  const startDate = parseDateValue(dateValue);
  const start = parseTimeValue(startTime);
  const endDateKey = resolveEventEndDate(dateValue, startTime, endDateValue, endTime);
  const end = parseTimeValue(endTime);

  if (!startDate || !start || !end || !DATE_REGEX.test(endDateKey || "")) {
    return null;
  }

  const [endYear, endMonth, endDay] = endDateKey.split("-").map(Number);
  const startDateTime = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), start.hours, start.minutes, 0, 0);
  const endDateTime = new Date(endYear, endMonth - 1, endDay, end.hours, end.minutes, 0, 0);

  if (
    startDateTime.getFullYear() !== startDate.getFullYear() ||
    startDateTime.getMonth() !== startDate.getMonth() ||
    startDateTime.getDate() !== startDate.getDate() ||
    endDateTime.getFullYear() !== endYear ||
    endDateTime.getMonth() !== endMonth - 1 ||
    endDateTime.getDate() !== endDay
  ) {
    return null;
  }

  return { start: startDateTime, end: endDateTime, endDate: endDateKey };
}

export function formatEventDateRange(dateValue, endDateValue) {
  const start = formatDateDisplay(dateValue, { includeYear: true });
  if (!endDateValue || !DATE_REGEX.test(endDateValue || "") || String(endDateValue) === String(dateValue)) {
    return start;
  }

  const end = formatDateDisplay(endDateValue, { includeYear: true });
  return `${start} - ${end}`;
}

export function formatEventDateTimeRange(dateValue, startTime, endDateValue, endTime) {
  const startDate = formatDateDisplay(dateValue, { includeYear: true });
  const startTimeLabel = formatTime12h(startTime);
  const endDateKey = resolveEventEndDate(dateValue, startTime, endDateValue, endTime);
  const endDate = formatDateDisplay(endDateKey || endDateValue, { includeYear: true });
  const endTimeLabel = formatTime12h(endTime);

  if (!startDate || !startTimeLabel) {
    return formatEventDateRange(dateValue, endDateValue);
  }

  if (endDateKey && endDateKey !== dateValue) {
    if (endDate && endTimeLabel) {
      return `${startDate} ${startTimeLabel} - ${endDate} ${endTimeLabel}`;
    }

    if (endDate) {
      return `${startDate} ${startTimeLabel} - ${endDate}`;
    }
  }

  if (startTimeLabel && endTimeLabel) {
    return `${startDate} ${startTimeLabel} - ${endTimeLabel}`;
  }

  return `${startDate} ${startTimeLabel}`;
}

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
