#!/usr/bin/env node
/**
 * Generate AUS update.xml files for Windows MARs.
 * Mirrors @zen-browser/surfer's generateBrowserUpdateFiles for WINNT targets.
 */
import { createHash } from 'node:crypto'
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'

const ausPlatforms = {
  x86_64: ['WINNT_x86_64-msvc', 'WINNT_x86_64-msvc-x64'],
  aarch64: ['WINNT_aarch64-msvc-aarch64'],
}

function parseArgs(argv) {
  const out = {}
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    out[a.slice(2)] = argv[++i]
  }
  return out
}

function sha512File(path) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha512')
    createReadStream(path)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('hex')))
  })
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function readBuildId(objDir, marSourceDir) {
  const candidates = [
    marSourceDir ? join(marSourceDir, 'platform.ini') : null,
    join(objDir, 'dist', 'bin', 'platform.ini'),
    join(objDir, 'dist', 'astra', 'platform.ini'),
    join('dist', 'mar-source', 'platform.ini'),
  ].filter(Boolean)
  for (const p of candidates) {
    if (!existsSync(p)) continue
    const m = readFileSync(p, 'utf8').match(/^BuildID=(.+)$/m)
    if (m) return m[1].trim()
  }
  throw new Error(`BuildID not found under ${objDir}`)
}

function marNameForArch(arch) {
  return arch === 'aarch64' ? 'windows-arm64.mar' : 'windows.mar'
}

function buildUpdateXml({
  version,
  platformVersion,
  buildID,
  url,
  hashValue,
  size,
}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<updates>
  <update type="minor" displayVersion="${xmlEscape(version)}" appVersion="${xmlEscape(version)}" platformVersion="${xmlEscape(platformVersion)}" buildID="${xmlEscape(buildID)}">
    <patch type="complete" URL="${xmlEscape(url)}" hashFunction="sha512" hashValue="${xmlEscape(hashValue)}" size="${xmlEscape(size)}"/>
  </update>
</updates>
`
}

async function main() {
  const args = parseArgs(process.argv)
  for (const key of [
    'mar',
    'version',
    'channel',
    'arch',
    'repo',
    'obj-dir',
    'ff-version',
  ]) {
    if (!args[key]) {
      console.error(`Missing --${key}`)
      process.exit(1)
    }
  }

  const targets = ausPlatforms[args.arch]
  if (!targets) {
    console.error(`Unsupported arch: ${args.arch}`)
    process.exit(1)
  }
  if (!existsSync(args.mar)) {
    console.error(`MAR not found: ${args.mar}`)
    process.exit(1)
  }

  const marSize = statSync(args.mar).size
  const hashValue = await sha512File(args.mar)
  const buildID = readBuildId(args['obj-dir'], args['mar-source'])
  const marFile = marNameForArch(args.arch)
  // Release assets are tagged with displayVersion; twilight assets use twilight-1.
  const downloadTag = args.channel === 'twilight' ? 'twilight-1' : args.version
  const completeMarURL = `https://github.com/${args.repo}/releases/download/${downloadTag}/${marFile}`

  const xml = buildUpdateXml({
    version: args.version,
    platformVersion: args['ff-version'],
    buildID,
    url: completeMarURL,
    hashValue,
    size: marSize,
  })

  const outRoot = args.out || join('dist', 'update')
  for (const target of targets) {
    const xmlPath = join(outRoot, 'browser', target, args.channel, 'update.xml')
    mkdirSync(dirname(xmlPath), { recursive: true })
    writeFileSync(xmlPath, xml)
    console.log(`Wrote ${xmlPath}`)
    console.log(`  mar=${marSize} bytes buildID=${buildID}`)
    console.log(`  URL=${completeMarURL}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
