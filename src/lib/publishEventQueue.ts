import { StringKeyMap } from './types'

class PublishEventQueue {
    protected queue: StringKeyMap[] = []

    push(event: StringKeyMap) {
        this.queue.push(event)
    }

    items(): StringKeyMap[] {
        return [...this.queue]
    }
}

export default PublishEventQueue
