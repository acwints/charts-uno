import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const errors = []

const requiredAgentDocs = ['AGENTS.md', 'packages/web/AGENTS.md', 'packages/api/AGENTS.md']

for (const relativePath of requiredAgentDocs) {
  if (!existsSync(path.join(root, relativePath))) {
    errors.push(`Missing required agent doc: ${relativePath}`)
  }
}

const cssRoot = path.join(root, 'packages', 'web', 'src')

function walkCssFiles(dir) {
  const files = []
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      files.push(...walkCssFiles(fullPath))
      continue
    }
    if (entry.endsWith('.css')) {
      files.push(fullPath)
    }
  }
  return files
}

function getLineNumber(content, index) {
  return content.slice(0, index).split('\n').length
}

const cssFiles = walkCssFiles(cssRoot)

for (const cssFile of cssFiles) {
  const content = readFileSync(cssFile, 'utf8')
  const relativePath = path.relative(root, cssFile)

  if (/transition\s*:\s*all\b/i.test(content)) {
    errors.push(`Disallowed "transition: all" in ${relativePath}`)
  }

  for (const match of content.matchAll(/:focus(?!-visible|-within)/g)) {
    const line = getLineNumber(content, match.index ?? 0)
    errors.push(`Use :focus-visible in ${relativePath}:${line}`)
  }

  const hasTransition = /transition\s*:/.test(content)
  const hasReducedMotionQuery = /prefers-reduced-motion\s*:\s*reduce/.test(content)
  if (hasTransition && !hasReducedMotionQuery) {
    errors.push(`Missing reduced-motion override in ${relativePath}`)
  }
}

let trackedFiles = []
try {
  trackedFiles = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
} catch {
  errors.push('Unable to read tracked files with git ls-files')
}

for (const trackedFile of trackedFiles) {
  const base = path.basename(trackedFile)
  const isDotEnvFile = /^\.env(\..+)?$/.test(base)
  const isAllowedTemplate =
    base === '.env.example' || base === '.env.sample' || base === '.env.template'
  if (isDotEnvFile && !isAllowedTemplate) {
    errors.push(`Sensitive env file appears tracked: ${trackedFile}`)
  }
}

const botStateTemplatePath = path.join(root, 'packages', 'bot', 'bot-state.json')
if (!existsSync(botStateTemplatePath)) {
  errors.push('Missing required bot state template: packages/bot/bot-state.json')
} else {
  try {
    const botStateTemplate = JSON.parse(readFileSync(botStateTemplatePath, 'utf8'))
    if (botStateTemplate.oauth2 !== null) {
      errors.push('packages/bot/bot-state.json must keep oauth2 set to null (no embedded tokens)')
    }
  } catch {
    errors.push('packages/bot/bot-state.json must be valid JSON')
  }
}

if (errors.length > 0) {
  console.error('Harness checks failed:\n')
  for (const error of errors) {
    console.error(`- ${error}`)
  }
  process.exit(1)
}

console.log(`Harness checks passed (${cssFiles.length} CSS files scanned).`)
