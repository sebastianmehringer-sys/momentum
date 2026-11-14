import { baseFields, deleteRow, saveRow } from './data'
import { db } from './db'
import { requestAchievementCheck } from './push'

/** Setzt oder entfernt das Häkchen einer Gewohnheit für einen Tag. */
export async function toggleHabitCheck(habitId: string, date: string) {
  // Feste id pro Gewohnheit + Tag: so entsteht auch mit zwei Geräten nie ein doppeltes Häkchen
  const id = `${habitId}:${date}`
  const existing = await db().habit_checks.get(id)
  if (existing && !existing.deleted_at) {
    await deleteRow('habit_checks', id)
  } else {
    await saveRow('habit_checks', {
      ...baseFields(),
      ...(existing ? { created_at: existing.created_at } : {}),
      id,
      habit_id: habitId,
      date,
    })
    // Vielleicht ist damit ein Streak-Meilenstein (7/30/100 Tage) erreicht
    requestAchievementCheck()
  }
}

/** Löscht eine Gewohnheit samt ihren Häkchen. */
export async function deleteHabit(habitId: string) {
  const checks = await db().habit_checks.where('habit_id').equals(habitId).toArray()
  for (const c of checks) if (!c.deleted_at) await deleteRow('habit_checks', c.id)
  await deleteRow('habits', habitId)
}
