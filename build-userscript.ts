/// <reference types="node" />
import { readdirSync, readFileSync, writeFileSync } from 'fs'
import { build, type BuildOptions } from 'esbuild'
import * as path from 'path'
import './src/types.d.ts' // they are global anyway but vscode shits itself sometimes

const STYLE_CSS = readdirSync('resources/css')
  .filter(f => f.endsWith('.css'))
  .map(f => readFileSync(path.join('resources/css', f), 'utf8'))
  .join('\n')

const BORDERS: Borders = JSON.parse(readFileSync('resources/borders.json', 'utf8'))
const MANIFEST: Manifest = JSON.parse(readFileSync('manifest.json', 'utf8'))

// TODO: Dynamically insert @include tags depending on matches arr count
const contentScripts = MANIFEST.content_scripts[0]
const HEADER = `// ==UserScript==
// @name        ${MANIFEST.name}
// @version     ${MANIFEST.version}
// @description ${MANIFEST.description}
// @author      ${MANIFEST.author}
// @include     ${contentScripts.matches[0]}
// @include     ${contentScripts.matches[1]}
// @icon        https://raw.githubusercontent.com/EarthMC-Toolkit/earthmc-dynmap/main/resources/icon48.png
// @downloadURL https://raw.githubusercontent.com/EarthMC-Toolkit/earthmc-dynmap/main/dist/emc-dynmapplus.user.js
// @grant       GM_addStyle
// @grant       GM_getResourceURL
// @grant       GM_xmlhttpRequest
// ==/UserScript==
`

const outdir = 'dist'
const outfile = path.join(outdir, 'emc-dynmapplus.user.js')

const buildOpts: BuildOptions = {
    entryPoints: ['resources/interceptor.js', ...contentScripts.js],
    outdir: outdir,
    format: 'esm',
    target: ['es2020'], // Backwards compatible enough. Most browsers support it.
    bundle: true,       // IMPORTANT: must be true otherwise we don't get a single user.js file with inlined dependencies.
    write: false,       // Do not write to a file, we do that ourselves below after appending header etc.
    treeShaking: false, // Don't remove dead code since false positives are common and doing so will cause errors.
    define: {
        // Make some resources and flags available to userscript when in use.
        IS_USERSCRIPT: 'true',
        STYLE_CSS: JSON.stringify(STYLE_CSS),
        BORDERS: JSON.stringify(BORDERS),
        MANIFEST: JSON.stringify(MANIFEST),
        // Swap out instances of keywords with their userscript compatible counterpart.
        window: 'unsafeWindow',
        'chrome.runtime.getURL': 'GM_getResourceURL',
    }
}

const start = performance.now()
build(buildOpts).then(res => {
    const contentCode = res.outputFiles?.map(f => f.text).join('\n')
    writeFileSync(outfile, `${HEADER}\n${contentCode}`)

    const elapsed = (performance.now() - start).toFixed(2)
    const relPath = '.' + path.sep + path.relative(process.cwd(), outfile)
    console.log(`Successfully generated userscript.\n\tOutput: ${relPath}\n\tTook: ${elapsed}ms\n`)
})