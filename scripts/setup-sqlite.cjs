/**
 * Fetches a prebuilt better-sqlite3 native binary matching the installed
 * Electron ABI and places it under node_modules/better-sqlite3.
 *
 * Background: better-sqlite3 v12+ compiles from source via node-gyp on
 * `npm install`, which requires the Visual Studio C++ workload. On machines
 * without it (and where the bundled prebuild does not cover the Electron
 * ABI), we download the matching prebuild tarball from the upstream GitHub
 * releases instead. The tarballs are published by WiseLibs/better-sqlite3
 * for many Electron ABIs, so no source compilation is needed.
 *
 * Windows x64 only (this project targets Windows NSIS + portable builds).
 */
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const https = require('node:https')
const os = require('node:os')
const path = require('node:path')

const PROJECT_ROOT = path.resolve(__dirname, '..')
const SQLITE_ROOT = path.join(PROJECT_ROOT, 'node_modules', 'better-sqlite3')
const TARGET_FILE = path.join(SQLITE_ROOT, 'build', 'Release', 'better_sqlite3.node')

// Newest first. The native addon interface is stable across v12.x, so a
// slightly newer binary than the npm package is acceptable.
const GITHUB_VERSIONS = ['12.12.0', '12.11.1']

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'myownplayer2-setup' } }, (res) => {
        if (res.statusCode !== undefined && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume()
          download(res.headers.location, dest).then(resolve, reject)
          return
        }
        if (res.statusCode !== 200) {
          res.resume()
          reject(new Error(`download failed: HTTP ${res.statusCode} for ${url}`))
          return
        }
        const out = fs.createWriteStream(dest)
        res.pipe(out)
        out.on('finish', () => resolve())
        out.on('error', reject)
      })
      .on('error', reject)
  })
}

async function urlExists(url) {
  return new Promise((resolve) => {
    https
      .get(url, { method: 'HEAD', headers: { 'User-Agent': 'myownplayer2-setup' } }, (res) => {
        res.resume()
        if (res.statusCode !== undefined && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          urlExists(res.headers.location).then(resolve)
          return
        }
        resolve(res.statusCode === 200)
      })
      .on('error', () => resolve(false))
  })
}

function electronAbi() {
  const electronPkg = require(path.join(PROJECT_ROOT, 'node_modules', 'electron', 'package.json'))
  const electronBin =
    process.platform === 'win32'
      ? path.join(PROJECT_ROOT, 'node_modules', 'electron', 'dist', 'electron.exe')
      : path.join(PROJECT_ROOT, 'node_modules', 'electron', 'dist', 'electron')
  if (!fs.existsSync(electronBin)) {
    throw new Error(
      `Electron binary not found at ${electronBin} (electron@${electronPkg.version}). ` +
        'Run `npm install` first so the Electron download completes.'
    )
  }
  const abi = execFileSync(electronBin, ['-p', 'process.versions.modules'], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    encoding: 'utf8'
  }).trim()
  return { version: electronPkg.version, abi }
}

async function main() {
  const force = process.argv.includes('--force')
  if (process.platform !== 'win32' || process.arch !== 'x64') {
    throw new Error(`setup-sqlite.cjs currently supports Windows x64 only (got ${process.platform}/${process.arch}).`)
  }
  if (!force && fs.existsSync(TARGET_FILE)) {
    console.log(`[setup-sqlite] native binding already present at ${TARGET_FILE}, skipping.`)
    return
  }
  const bsPkg = require(path.join(SQLITE_ROOT, 'package.json'))
  if (!/^12\./.test(bsPkg.version)) {
    throw new Error(`setup-sqlite.cjs expects better-sqlite3 v12.x, found ${bsPkg.version}.`)
  }
  const { version: electronVersion, abi } = electronAbi()
  console.log(`[setup-sqlite] electron@${electronVersion} ABI=${abi}, better-sqlite3@${bsPkg.version}`)

  let assetUrl = null
  for (const ghv of GITHUB_VERSIONS) {
    const candidate =
      `https://github.com/WiseLibs/better-sqlite3/releases/download/v${ghv}/` +
      `better-sqlite3-v${ghv}-electron-v${abi}-win32-x64.tar.gz`
    if (await urlExists(candidate)) {
      assetUrl = candidate
      break
    }
    console.log(`[setup-sqlite] no prebuild in better-sqlite3 v${ghv} for ABI ${abi}, trying next...`)
  }
  if (!assetUrl) {
    throw new Error(
      `[setup-sqlite] no win32-x64 prebuild found for Electron ABI ${abi} ` +
        `(tried ${GITHUB_VERSIONS.join(', ')}). Install the VS C++ workload and run npm rebuild better-sqlite3.`
    )
  }
  const tmpFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bsqlite-')), 'prebuild.tar.gz')
  console.log(`[setup-sqlite] downloading ${assetUrl}`)
  await download(assetUrl, tmpFile)
  execFileSync('tar', ['-xzf', tmpFile, '-C', SQLITE_ROOT], { stdio: 'inherit' })
  fs.rmSync(path.dirname(tmpFile), { recursive: true, force: true })
  if (!fs.existsSync(TARGET_FILE)) {
    throw new Error(`[setup-sqlite] extraction did not produce ${TARGET_FILE}.`)
  }
  console.log(`[setup-sqlite] installed native binding for Electron ABI ${abi}.`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
