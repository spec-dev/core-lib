import { serve } from 'https://deno.land/std@0.150.0/http/server.ts'
import { Queue, StringKeyMap, BigInt } from 'https://esm.sh/@spec.dev/core@0.0.122'
import jwt from 'https://esm.sh/jsonwebtoken@8.5.1'
import LiveTable from './spec.ts'
import inputContractGroupAbis from './_abis.ts'

const errors = {
    INVALID_PAYLOAD: 'Invalid payload',
    UNAUTHORIZED: 'Unauthorized request',
}

const codes = {
    SUCCESS: 200,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    INTERNAL_SERVER_ERROR: 500,
}

const headerNames = {
    AUTH_TOKEN: 'Spec-Auth-Token',
    TABLES_AUTH_TOKEN: 'Spec-Tables-Auth-Token',
}

const config = {
    JWT_SECRET: Deno.env.get('JWT_SECRET'),
    JWT_ROLE: 'internal',
}

if (!config.JWT_SECRET) {
    throw `"JWT_SECRET" environment variable required.`
}

function resp(data: StringKeyMap, code: number = codes.SUCCESS): Response {
    return new Response(JSON.stringify(data), {
        status: code,
        headers: { 'Content-Type': 'application/json' },
    })
}

function verifyJWT(token: string): boolean {
    try {
        const claims = jwt.verify(token, config.JWT_SECRET)
        return claims?.role === config.JWT_ROLE
    } catch (err) {
        console.error(err)
        return false
    }
}

function authRequest(req: any): StringKeyMap {
    const headers = req.headers || {}
    const authToken =
        headers.get(headerNames.AUTH_TOKEN) || headers.get(headerNames.AUTH_TOKEN.toLowerCase())

    if (!authToken || !verifyJWT(authToken)) {
        return { isAuthed: false }
    }

    const tablesApiToken =
        headers.get(headerNames.TABLES_AUTH_TOKEN) ||
        headers.get(headerNames.TABLES_AUTH_TOKEN.toLowerCase())

    return { isAuthed: true, tablesApiToken }
}

async function parseInputsFromPayload(req: any): Promise<StringKeyMap[]> {
    let inputs
    try {
        inputs = (await req.json()) || []
    } catch (err) {
        return null
    }
    for (const input of inputs) {
        if (!input.name || !input.origin) {
            return null
        }
    }
    return inputs as StringKeyMap[]
}

serve(async (req: Request) => {
    // Auth the request and get the API token to use for queries to shared tables.
    const { isAuthed, tablesApiToken } = authRequest(req)
    if (!isAuthed) {
        return resp({ error: errors.UNAUTHORIZED }, codes.UNAUTHORIZED)
    }

    // The request payload is just the input calls or events.
    const inputs = await parseInputsFromPayload(req)
    if (inputs === null) {
        return resp({ error: errors.INVALID_PAYLOAD }, codes.BAD_REQUEST)
    }
    if (!inputs.length) {
        return resp([])
    }

    // Process input calls/events in series.
    const allPublishedEvents = []
    const allNewContractInstances = []
    for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i] as any
        input.origin.blockNumber = BigInt.from(input.origin.blockNumber)
        input.origin.blockTimestamp = new Date(input.origin.blockTimestamp)

        // Create the live object with a single event queue instance to capture published events
        // and a single contract registration queue to capture new contracts to be registered.
        const publishedEventQueue = new Queue()
        const contractRegistrationQueue = new Queue()
        const liveObject = new LiveTable(
            inputContractGroupAbis,
            publishedEventQueue,
            contractRegistrationQueue
        )
        liveObject._tablesApiToken = tablesApiToken

        // Check whether the input is an event or a call.
        const isContractCall = input?.hasOwnProperty('inputs')
        const handlerType = isContractCall ? 'handleCall' : 'handleEvent'

        // Handle the event and auto-save.
        try {
            if (await liveObject[handlerType](input)) {
                await liveObject.save()
            }
        } catch (err) {
            console.error(err)
            return resp(
                {
                    error: err?.message || err,
                    index: i,
                    publishedEvents: allPublishedEvents,
                    newContractInstances: allNewContractInstances,
                },
                codes.INTERNAL_SERVER_ERROR
            )
        }
        allPublishedEvents.push(liveObject._publishedEvents)
        allNewContractInstances.push(liveObject._newContractInstances)
    }

    // Return the generated events to be published
    // and any new contract instances to be registered.
    return resp({
        publishedEvents: allPublishedEvents,
        newContractInstances: allNewContractInstances,
    })
})
