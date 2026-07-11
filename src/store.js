const PREFIX = "emcdynmapplus-"

class Store {
	static local = class {
		static #key(key, prefix = null) {
			return `${prefix || PREFIX}${key}`
		}

		static get(key, defaultValue = null, prefix = null) {
			const raw = localStorage.getItem(this.#key(key, prefix))
			if (raw === null) return defaultValue

			try {
				const parsed = JSON.parse(raw)
				if (parsed && typeof parsed === "object" && "__storage" in parsed) {
					if (parsed.expires && Date.now() > parsed.expires) {
						this.delete(key, prefix)
						return defaultValue
					}

					return parsed.value
				}

				if (Array.isArray(parsed) || (parsed && typeof parsed === "object")) {
					return parsed
				}
			} catch {}

			return raw
		}

		static set(key, value, prefix = null) {
			if (typeof value === 'boolean') {
				localStorage.setItem(this.#key(key, prefix), String(value))
			} else {
				const v = typeof value === "string" ? value : JSON.stringify({ __storage: true, value })
				localStorage.setItem(this.#key(key, prefix), v)
			}
		}

		static setWithTTL(key, value, ttlMs, prefix = null) {
            const v = JSON.stringify({ __storage: true, value, expires: Date.now() + ttlMs })
			localStorage.setItem(this.#key(key, prefix), v)
		}

		static async cache(key, ttlMs, callback, prefix = null) {
			const cached = this.get(key, null, prefix)
			if (cached !== null) return cached

			const value = await callback()
			this.setWithTTL(key, value, ttlMs, prefix)

			return value
		}

		static has(key, prefix = null) {
			return this.get(key, null, prefix) !== null
		}

		static delete(key, prefix = null) {
			localStorage.removeItem(this.#key(key, prefix))
		}

		// static clear(prefix = PREFIX) {
		// 	for (const key of Object.keys(localStorage)) {
		// 		if (!key.startsWith(prefix)) continue
		// 		localStorage.removeItem(key)
		// 	}
		// }

		// static keys = (prefix = PREFIX) => Object.keys(localStorage)
		// 	.filter(k => k.startsWith(prefix))
		// 	.map(k => k.substring(prefix.length))

		// static toggle(key, prefix = null) {
		// 	const value = !this.get(key, false, prefix)
		// 	this.set(key, value, prefix)
		// 	return value
		// }

		// static cleanup(prefix = PREFIX) {
		// 	for (const key of this.keys(prefix)) {
		// 		this.get(key, null, prefix)
        //     }
		// }
	}

	static opfs = class {
		static async #root() {
			return navigator.storage.getDirectory()
		}

		static async #parent(path, create = false) {
			const parts = path.split("/").filter(Boolean)
			const file = parts.pop()

			let dir = await this.#root()
			for (const part of parts) {
				dir = await dir.getDirectoryHandle(part, { create })
            }

			return { dir, file }
		}

		static async exists(path) {
			try {
				const { dir, file } = await this.#parent(path)
				await dir.getFileHandle(file)
				return true
			} catch {
				return false
			}
		}

		static async write(path, data) {
			const { dir, file } = await this.#parent(path, true)
			const handle = await dir.getFileHandle(file, { create: true })
			const writable = await handle.createWritable()

			await writable.write(data)
			await writable.close()
		}

		static async writeJSON(path, value) {
			await this.write(path, JSON.stringify(value))
		}

		static async read(path) {
			const { dir, file } = await this.#parent(path)
			const handle = await dir.getFileHandle(file)
			const f = await handle.getFile()
			return await f.text()
		}

		static async readJSON(path) {
			try {
				return JSON.parse(await this.read(path))
			} catch (e) {
				if (e.name === "NotFoundError") return null
				throw e
			}
		}

		static async blob(path) {
			const { dir, file } = await this.#parent(path)
			const handle = await dir.getFileHandle(file)
			return await handle.getFile()
		}

		static async cache(key, ttlMs, callback) {
			const metaPath = `.cache/${key}.json`
			try {
				const meta = await this.readJSON(metaPath)
				if (meta.expires > Date.now()) return meta.value

				await this.delete(metaPath)
			} catch {}

			const value = await callback()
			await this.writeJSON(metaPath, { value, expires: Date.now() + ttlMs })
			
			return value
		}

		static async delete(path) {
			const { dir, file } = await this.#parent(path)
			await dir.removeEntry(file)
		}

		// static size = (path) => this.blob(path).then(b => b.size)
		// static modified = (path) => this.blob(path).then(b => b.lastModified)

		// static async list(path = "") {
		// 	let dir = await this.#root()
		// 	for (const part of path.split("/").filter(Boolean)) {
		// 		dir = await dir.getDirectoryHandle(part)
        //     }

		// 	const files = []
		// 	for await (const [name, handle] of dir.entries()) {
		// 		files.push({ name, kind: handle.kind })
		// 	}

		// 	return files
		// }

		// static async mkdir(path) {
		// 	let dir = await this.#root()
		// 	for (const part of path.split("/").filter(Boolean)) {
		// 		dir = await dir.getDirectoryHandle(part, { create: true })
        //     }
		// }

		// static async deleteDir(path, recursive = true) {
		// 	const { dir, file } = await this.#parent(path)
		// 	await dir.removeEntry(file, { recursive })
		// }
	}
}