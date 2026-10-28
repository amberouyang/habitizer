import { createId } from "./id.js";
import { getLocalDateKey } from "./utils.js";
import { t } from "./i18n.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Example routines for first-time visitors, with two weeks of history dated
 * relative to `now` so every screen (Today, This week, History, streaks,
 * spaced practice) has something to show.
 */
const SAMPLE_ROUTINES = [
  {
    nameKey: "sample.morning",
    color: "ocean",
    hour: 7.5,
    daysAgo: [0, 1, 2, 3, 5, 6, 7, 8, 9, 11, 12, 13],
    activities: [["sample.stretch", 5], ["sample.water", 1], ["sample.plan", 4]],
  },
  {
    nameKey: "sample.workout",
    color: "coral",
    hour: 18,
    daysAgo: [1, 3, 6, 8, 10, 13],
    activities: [["sample.warmUp", 5], ["sample.run", 20], ["sample.coolDown", 5]],
  },
  {
    nameKey: "sample.language",
    color: "lavender",
    hour: 12.5,
    daysAgo: [4, 8, 10],
    activities: [["sample.flashcards", 10], ["sample.listening", 10]],
    // Last practiced 4 days ago on a 4-day interval, so it shows as due today.
    spaced: { srsLevel: 2, srsIntervalDays: 4 },
  },
  {
    nameKey: "sample.evening",
    color: "amber",
    hour: 21.5,
    daysAgo: [1, 2, 3, 4, 6, 7, 9, 10, 12],
    activities: [["sample.brush", 2], ["sample.skincare", 3], ["sample.read", 15]],
  },
];

function runTimestamp(now, daysAgo, hour) {
  const day = new Date(now.getTime() - daysAgo * DAY_MS);
  day.setHours(Math.floor(hour), Math.round((hour % 1) * 60), 0, 0);
  // Keep today's runs in the past even when the page is opened early.
  return Math.min(day.getTime(), now.getTime() - 5 * 60 * 1000);
}

function buildRoutine(sample, now) {
  const activities = sample.activities.map(([nameKey, estimatedMinutes]) => ({
    id: createId(),
    name: t(nameKey),
    estimatedMinutes,
    timeSpentMs: 0,
  }));
  const estimatedMinutes = activities.reduce((sum, activity) => sum + activity.estimatedMinutes, 0);
  const estimatedMs = estimatedMinutes * 60 * 1000;

  const runHistory = sample.daysAgo.map((daysAgo) => {
    const completedAt = runTimestamp(now, daysAgo, sample.hour);
    // Vary run length between 85% and 114% of the estimate.
    const totalMs = Math.round(estimatedMs * (0.85 + ((daysAgo * 37) % 30) / 100));
    return {
      id: createId(),
      completedAt,
      dateKey: getLocalDateKey(completedAt),
      totalMs,
      estimatedMs,
      activitiesCompleted: activities.length,
      activitiesTotal: activities.length,
    };
  });

  runHistory.forEach((run) => {
    activities.forEach((activity) => {
      activity.timeSpentMs += Math.round(run.totalMs / activities.length);
    });
  });

  return {
    id: createId(),
    name: t(sample.nameKey),
    color: sample.color,
    estimatedMinutes,
    activities,
    completionDates: runHistory.map((run) => run.dateKey).reverse(),
    runHistory,
    spacedRepetition: Boolean(sample.spaced),
    srsLevel: sample.spaced?.srsLevel ?? 0,
    srsIntervalDays: sample.spaced?.srsIntervalDays ?? null,
    nextDueDate: sample.spaced ? getLocalDateKey(now.getTime()) : null,
  };
}

export function createSampleRoutines(now = new Date()) {
  return SAMPLE_ROUTINES.map((sample) => buildRoutine(sample, now));
}
