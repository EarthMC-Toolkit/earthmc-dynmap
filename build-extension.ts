/// <reference types="node" />
import * as path from 'path'
import { statSync, readdirSync, createWriteStream } from 'fs'
import { ZipArchive, type Archiver } from 'archiver'

/**
 * Adds a directory to the archive, recursively, skipping ignored files.
 * @param archive Archiver instance
 * @param srcDir Source directory
 * @param destDir Destination path in the zip
 * @param ignore List of filenames to skip (relative to srcDir)
 */
function addDirIgnore(archive: Archiver, srcDir: string, destDir: string, ignore: string[] = []) {
	const dirContents = readdirSync(srcDir)
    for (const file of dirContents) {
		const fullPath = path.join(srcDir, file)
		const destPath = path.join(destDir, file)
		
        const stat = statSync(fullPath)
		if (stat.isDirectory()) {
			addDirIgnore(archive, fullPath, destPath, ignore)
		} else if (!ignore.includes(file)) {
			archive.file(fullPath, { name: destPath })
		}
	}
}

const EXT_NAME = 'emc-dynmapplus'
const outfile = path.join('dist', EXT_NAME+".zip")

const start = performance.now()
const archive = new ZipArchive({ zlib: { level: 9 } })

const output = createWriteStream(outfile) // We don't rly use this but its required to gen the zip via pipe()
archive.pipe(output)

addDirIgnore(archive, 'src', EXT_NAME+'/src', ['types.d.ts']) // Types are just for developing

archive.file('worker.js', { name: EXT_NAME + '/worker.js' })
archive.file('manifest.json', { name: EXT_NAME+'/manifest.json' })
archive.file('README.md', { name: EXT_NAME+'/README.md' })

archive.directory('resources', EXT_NAME+'/resources')
archive.directory('resources/gui', EXT_NAME+'/resources/gui', entry => {
    return entry.name.startsWith('map-mode') && entry.name.endsWith('.png') ? false : entry
})

archive.finalize().then(() => {
	const elapsed = (performance.now() - start).toFixed(2)
	const relPath = '.' + path.sep + path.relative(process.cwd(), outfile)
	console.log(`Successfully generated extension.\n\tOutput: ${relPath}\n\tTook: ${elapsed}ms\n`)
})