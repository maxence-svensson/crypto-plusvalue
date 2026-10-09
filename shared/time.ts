/**
 * Date et heure locales d'un fuseau horaire (`Europe/Paris`), converties en instant. Le décalage
 * est celui du fuseau à cette date : heure d'été comprise. `undefined` si la date, l'heure ou le
 * fuseau sont illisibles.
 */
export function zonedInstant(date: string, time: string, timeZone: string): Date | undefined {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const clock = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3})\d*)?)?$/.exec(time)
  if (!day || !clock) return undefined
  const local = Date.UTC(
    Number(day[1]),
    Number(day[2]) - 1,
    Number(day[3]),
    Number(clock[1]),
    Number(clock[2]),
    Number(clock[3] ?? '0'),
    Number((clock[4] ?? '0').padEnd(3, '0')),
  )
  if (Number.isNaN(local)) return undefined
  let format: Intl.DateTimeFormat
  try {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return undefined
  }
  // Décalage du fuseau à un instant : heure affichée dans le fuseau moins l'heure UTC.
  const offset = (instant: number) => {
    const parts = Object.fromEntries(
      format.formatToParts(new Date(instant)).map((part) => [part.type, Number(part.value)]),
    )
    const shown = Date.UTC(
      parts.year ?? 0,
      (parts.month ?? 1) - 1,
      parts.day ?? 1,
      parts.hour ?? 0,
      parts.minute ?? 0,
      parts.second ?? 0,
    )
    return shown - Math.floor(instant / 1000) * 1000
  }
  // Deux passes : le décalage peut changer entre l'heure locale et l'instant cherché.
  const first = local - offset(local)
  return new Date(local - offset(first))
}

/** Date et heure à Paris d'un instant, pour un champ de formulaire : ["2025-03-03", "09:20"]. */
export function parisParts(instant: Date): [string, string] {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Paris',
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  )
  return [`${parts.year}-${parts.month}-${parts.day}`, `${parts.hour}:${parts.minute}`]
}

/** Date et heure à Paris d'un instant, à la seconde : « 2025-03-03 09:20:02 ». */
export function parisTimestamp(instant: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Paris',
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
}
