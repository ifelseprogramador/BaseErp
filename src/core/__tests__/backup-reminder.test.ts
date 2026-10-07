import { describe, expect, it } from "vitest";
import { BACKUP_REMINDER_OPTIONS, isBackupReminderDue, isValidReminderHours } from "@/core/backup";

const now = new Date("2026-10-07T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

describe("isBackupReminderDue", () => {
  it("nunca baixou: lembra (se o lembrete estiver ligado)", () => {
    expect(isBackupReminderDue({ reminderHours: 3, lastDownloadAt: null }, now)).toBe(true);
  });

  it("dentro do intervalo não lembra; passado o intervalo lembra", () => {
    expect(isBackupReminderDue({ reminderHours: 3, lastDownloadAt: hoursAgo(2.9) }, now)).toBe(
      false,
    );
    expect(isBackupReminderDue({ reminderHours: 3, lastDownloadAt: hoursAgo(3) }, now)).toBe(true);
    expect(isBackupReminderDue({ reminderHours: 24, lastDownloadAt: hoursAgo(5) }, now)).toBe(
      false,
    );
  });

  it("desligado (0 horas) nunca lembra", () => {
    expect(isBackupReminderDue({ reminderHours: 0, lastDownloadAt: null }, now)).toBe(false);
    expect(isBackupReminderDue({ reminderHours: 0, lastDownloadAt: hoursAgo(999) }, now)).toBe(
      false,
    );
  });
});

describe("isValidReminderHours", () => {
  it("aceita só os intervalos oferecidos", () => {
    for (const h of BACKUP_REMINDER_OPTIONS) expect(isValidReminderHours(h)).toBe(true);
    for (const h of [-1, 2, 5, 100, 1.5]) expect(isValidReminderHours(h)).toBe(false);
  });
});
