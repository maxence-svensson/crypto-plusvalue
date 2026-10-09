/**
 * Captures d'écran du README, prises dans un navigateur Chromium sans interface (Chrome, Edge…)
 * piloté par le protocole DevTools, sans dépendance à installer.
 *
 *   npm run build && PORT=3002 node .output/server/index.mjs
 *   CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node scripts/captures.mjs
 *
 * Variables : CHROME_PATH (navigateur), BASE_URL (http://localhost:3002 par défaut).
 */
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BROWSER =
  process.env.CHROME_PATH ?? '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
const BASE = process.env.BASE_URL ?? 'http://localhost:3002'
const OUT = new URL('../docs/captures/', import.meta.url)
const DEBUG_PORT = 9333

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const profile = await mkdtemp(join(tmpdir(), 'captures-'))
const browser = spawn(
  BROWSER,
  [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profile}`,
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ],
  { stdio: 'ignore' },
)

let socketUrl
for (let attempt = 0; attempt < 50 && !socketUrl; attempt++) {
  await sleep(200)
  try {
    const pages = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json()
    socketUrl = pages.find((page) => page.type === 'page')?.webSocketDebuggerUrl
  } catch {
    // Le navigateur démarre encore.
  }
}
if (!socketUrl) throw new Error('Navigateur injoignable : vérifiez CHROME_PATH.')

const socket = new WebSocket(socketUrl)
await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }))
let lastId = 0
const pending = new Map()
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  const callback = pending.get(message.id)
  if (!callback) return
  pending.delete(message.id)
  callback(message)
})
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++lastId
    pending.set(id, (message) =>
      message.error ? reject(new Error(message.error.message)) : resolve(message.result),
    )
    socket.send(JSON.stringify({ id, method, params }))
  })

const evaluate = async (expression) =>
  (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result
    .value

async function open(path, { width, height, scale, wait, theme = 'light' }) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: scale,
    mobile: width < 600,
  })
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: theme }],
  })
  await send('Page.navigate', { url: BASE + path })
  // Laisse charger l'exemple, récupérer les cours et finir l'animation de la case.
  await sleep(wait)
}

/** Fait défiler jusqu'à un bloc, pour qu'il finisse d'apparaître (directive v-reveal). */
async function reach(selector) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView()`)
  await sleep(1200)
}

/** Rectangle d'un élément dans la page, avec une marge autour. */
async function areaOf(selector, margin = 24) {
  return evaluate(`(() => {
    const box = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect()
    return { x: box.x + scrollX - ${margin}, y: box.y + scrollY - ${margin},
             width: box.width + ${2 * margin}, height: box.height + ${2 * margin}, scale: 1 }
  })()`)
}

async function capture(name, clip) {
  const { data } = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: Boolean(clip),
    ...(clip ? { clip } : {}),
  })
  await writeFile(new URL(`${name}.png`, OUT), Buffer.from(data, 'base64'))
  console.log(`docs/captures/${name}.png`)
}

await mkdir(OUT, { recursive: true })
await send('Page.enable')

await open('/', { width: 1280, height: 800, scale: 2, wait: 3500 })
await capture('accueil')

// Fenêtre haute : les halos du fond sont fixes et ne couvrent que la fenêtre, une capture
// au-delà laisserait une coupure.
await open('/?exemple', { width: 1280, height: 2500, scale: 2, wait: 10000 })
// Tranche à 11 % : la comparaison des deux régimes s'affiche.
await evaluate(`document.querySelector('input[name="tranche"][value="0.11"]').click()`)
await sleep(800)
await capture('resultat', await areaOf('section[aria-labelledby="etape-resultat"]'))

await evaluate(`(() => {
  const slider = document.querySelector('#part-a-vendre')
  slider.value = 60
  slider.dispatchEvent(new Event('input', { bubbles: true }))
})()`)
await reach('#simulation')
await sleep(800)
await capture('simulateur', await areaOf('#simulation > div', 0))

await open('/', { width: 390, height: 844, scale: 3, wait: 3500 })
await capture('mobile')

await open('/?exemple', { width: 1280, height: 800, scale: 2, wait: 10000, theme: 'dark' })
await capture('sombre')

socket.close()
const exited = new Promise((resolve) => browser.once('exit', resolve))
browser.kill()
await exited
await rm(profile, { recursive: true, force: true, maxRetries: 5 })
