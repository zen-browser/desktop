/* global Services */ // For linter

console.log("ZenEdgeScrollParent: " + "alive" + "\n");

function logParentActor(message) {
  // dump("ZenEdgeScrollParentActor: " + message + "\n");
}

export class ZenEdgeScrollParent extends JSWindowActorParent {
  constructor() {
    super();
    // logParentActor("Constructor");
  }

  // This actor primarily sends messages to its children.
  // It might receive messages if a child needs to query the parent for info.
  async receiveMessage(message) {
    logParentActor(`Parent received message: ${message.name} from child in ${message.browsingContext?.currentWindowGlobal?.documentURI?.spec}`);
    // Handle any messages from child if needed in the future
  }

  // Called by ZenEdgeScrollManager to send a message to a specific child actor
  sendEventToChild(browsingContext, messageName, eventData) {
    if (!browsingContext) {
      logParentActor(`sendEventToChild: No browsingContext provided for ${messageName}.`);
      return;
    }
    logParentActor(`Parent sending ${messageName} to child in context: ${browsingContext.currentWindowGlobal?.documentURI?.spec}`);
    this.sendAsyncMessage(messageName, eventData);
  }

  destroy() {
    // logParentActor("Destroying ZenEdgeScrollParent");
    super.destroy();
  }
}