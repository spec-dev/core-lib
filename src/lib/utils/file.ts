import { StringKeyMap, Manifest } from '../types'
import { promises as fs } from 'fs'

interface LineDictionary {
    [key: string]: string
}

interface Property {
    name: string
    type: string
    desc: string
}
const { parse } = require('comment-parser')

export async function readTextFile(path: string): Promise<string> {
    const decoder = new TextDecoder('utf-8')
    const data = await fs.readFile(path)
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

export async function buildPropertyMetadata(liveObjectSpecPath: string): Promise<Property[]> {
    // Read Live Object spec.ts file contents.
    const specFileContents = await readTextFile(liveObjectSpecPath)
    if (!specFileContents) return []

    // Get property lines of Live Object.
    const { propertyLines, comments, decoratorLines } =
        findPropertyLinesAndComments(specFileContents)
    if (!propertyLines.length) return []

    // Get multiline comments
    const parsed = parse(specFileContents)

    for (let i = 0; i < parsed.length; i++) {
        const currentComment = parsed[i]
        const sourceLength = currentComment.source.length
        const lineNumber = currentComment.source[sourceLength - 1].number + 1
        const description = currentComment.description
        comments[lineNumber] = description
    }

    // Group and attribute comments to decorators
    const descriptions = {}
    for (const [decoratorLine, decoratorTitle] of Object.entries(decoratorLines)) {
        let description = ''
        let commentsToAdd: String[] = []
        for (const [lineNumber, comment] of Object.entries(comments)) {
            const currentLineNumber = parseInt(lineNumber)
            if (currentLineNumber < parseInt(decoratorLine)) {
                commentsToAdd.push(comment)
                delete comments[lineNumber]
            }
        }
        description = commentsToAdd.join(' ')
        descriptions[decoratorTitle] = description
    }

    // Parse property name:type info from property lines.
    let properties: Property[] = []
    for (const line of propertyLines) {
        // Get accomanying comment from property name:type
        const desc = descriptions[line]
        const { name, type } = parsePropertyNameAndTypeFromLine(line)
        if (name && type) {
            let property = { name: name, type: type, desc: desc }
            properties.push(property)
        }
    }
    return properties
}

function getLines(contents: string): string[] {
    return (contents || '').split('\n').map((line) => line.trim())
}

function findPropertyLinesAndComments(contents: string): {
    propertyLines: string[]
    comments: LineDictionary
    decoratorLines: LineDictionary
} {
    const lines = getLines(contents)
    const propertyLines: string[] = []
    const comments: LineDictionary = {}
    const decoratorLines: LineDictionary = {}
    let takeNextLine = false

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]

        // Avoid 0-indexed line number
        const currentLineNumber = i + 1

        // Designate lines to exclude for later
        if (line.startsWith('class') && line.includes('extends')) {
            decoratorLines[currentLineNumber] = 'Do not include.'
        }

        // Found a comment line.
        if (line.startsWith('//')) {
            let cleanedLine = line.replace('//', '').trim()
            comments[currentLineNumber] = cleanedLine
            continue
        }

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
            decoratorLines[currentLineNumber] = line
            propertyLines.push(line)
            takeNextLine = false
        }
    }

    return { propertyLines, comments, decoratorLines }
}

function parsePropertyNameAndTypeFromLine(line: string): StringKeyMap {
    const firstColonIndex = line.indexOf(':')
    if (firstColonIndex < 1) return { name: null, type: null }
    const preColon = line.slice(0, firstColonIndex).trim()
    const postColon = line.slice(firstColonIndex + 1).trim()
    const preColonWords = preColon.split(' ').filter((v) => !!v)
    const postColonWords = postColon.split(' ').filter((v) => !!v)
    const propertyName = preColonWords.pop()
    const propertyType = postColonWords[0]
    return { name: propertyName, type: propertyType }
}
