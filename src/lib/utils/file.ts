import { StringKeyMap, Manifest, PropertyMetadata } from '../types'
import stripComments from 'strip-comments'

export async function readTextFile(path: string): Promise<string> {
    const decoder = new TextDecoder('utf-8')
    // @ts-ignore
    const data = await Deno.readFile(path)
    return decoder.decode(data)
}

export async function readJsonFile(path: string): Promise<StringKeyMap | StringKeyMap[]> {
    return JSON.parse(await readTextFile(path))
}

export async function readManifest(liveObjectSpecPath: string): Promise<Manifest> {
    const callerDirComps = liveObjectSpecPath.split('/')
    callerDirComps.pop()
    const callerDirPath = callerDirComps.join('/')
    return (await readJsonFile(`${callerDirPath}/manifest.json`)) as Manifest
}

export async function buildPropertyMetadata(liveObjectSpecPath: string): Promise<{
    [key: string]: PropertyMetadata
}> {
    // Read Live Object spec.ts file contents.
    const specFileContents = await readTextFile(liveObjectSpecPath)
    if (!specFileContents) return {}

    // Get property lines of Live Object.
    const propertyLines = findPropertyLines(specFileContents)
    if (!propertyLines.length) return {}

    // Parse property name:type info from property lines.
    const metadata = {}
    for (const line of propertyLines) {
        const { name, type } = parsePropertyNameAndTypeFromLine(line)
        if (name && type) {
            metadata[name] = { type }
        }
    }
    return metadata
}

function getLines(contents: string): string[] {
    return (contents || '').split('\n').map((line) => line.trim())
}

function findPropertyLines(contents: string): string[] {
    const lines = getLines(stripComments(contents))
    const propertyLines: string[] = []
    let takeNextLine = false
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i]

        // Found property decorator.
        if (line.startsWith('@Property(')) {
            takeNextLine = true
            continue
        }
        if (!takeNextLine) continue

        // Another subsequent decorator under @Property.
        if (line.startsWith('@')) continue

        // Take property line.
        if (takeNextLine) {
            propertyLines.push(line)
            takeNextLine = false
        }
    }
    return propertyLines
}

function parsePropertyNameAndTypeFromLine(line: string): StringKeyMap {
    const firstColonIndex = line.indexOf(':')
    if (firstColonIndex < 1) return { name: null, type: null }
    const preColon = line.slice(0, firstColonIndex).trim()
    const postColon = line.slice(firstColonIndex + 1).trim()
    const preColonWords = preColon.split(' ').filter((v) => !!v)
    const postColonWords = postColon.split(' ').filter((v) => !!v)
    const propertyName = preColonWords.pop()
    let propertyType = postColonWords[0]
    while (propertyType.endsWith(';')) {
        propertyType = propertyType.slice(0, propertyType.length - 1)
    }
    return { name: propertyName, type: propertyType }
}
