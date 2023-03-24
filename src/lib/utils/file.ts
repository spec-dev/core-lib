export function readJsonFile(path: string) {
    const decoder = new TextDecoder('utf-8')
    // @ts-ignore
    const data = Deno.readFileSync(path)
    return JSON.parse(decoder.decode(data))
}
