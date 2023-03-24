export interface Bind {
    cb?: (file: string) => string
}

export const up = 3

export default function caller(this: Bind | any, levelUp = up) {
    const err = new Error()
    const stack = err.stack?.split('\n')[levelUp]
    if (stack) {
        return getFile.bind(this)(stack)
    }
}

export function getFile(this: Bind | any, stack: string) {
    stack = stack.substring(stack.indexOf('at ') + 3)
    if (!stack.startsWith('file://')) {
        stack = stack.substring(stack.lastIndexOf('(') + 1)
    }
    const path = stack.split(':')
    let file
    //@ts-ignore
    if (Deno.build.os == 'windows') {
        file = `${path[0]}:${path[1]}:${path[2]}`
    } else {
        file = `${path[0]}:${path[1]}`
    }

    if ((this as Bind)?.cb) {
        const cb = (this as Bind).cb as any
        file = cb(file)
    }
    return file
}
