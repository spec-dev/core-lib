import fs from 'fs'

export const dir = (path: string): string => {
    const split = path.split('/')
    split.pop()
    return split.join('/')
}

export const read = (path: string): string => {
    return fs.readFileSync(path, 'utf8')
}
