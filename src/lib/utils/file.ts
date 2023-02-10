import { readFileSync } from 'node:fs'

export const dir = (path: string): string => {
    const split = path.split('/')
    split.pop()
    return split.join('/')
}

export const read = (path: string): string => {
    return readFileSync(path, 'utf8')
}
