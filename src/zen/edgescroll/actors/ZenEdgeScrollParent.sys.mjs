/* global Services */ // For linter

export class ZenEdgeScrollParent extends JSWindowActorParent {
  constructor() {
    super();
  }

  // This actor primarily sends messages to its children.
  // It might receive messages if a child needs to query the parent for info.
  async receiveMessage(message) {
    // Handle any messages from child if needed in the future
  }

  // Called by ZenEdgeScrollManager to send a message to a specific child actor
  sendEventToChild(browsingContext, messageName, eventData) {
    if (!browsingContext) {
      return;
    }
    this.sendAsyncMessage(messageName, eventData);
  }

  destroy() {
    super.destroy();
  }
}
