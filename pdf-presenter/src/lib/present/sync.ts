import type { InkStroke, LaserPosition } from "../overlay-types";
import type { PresentMessage, PresentState } from "../types";

export function presentChannelName(sessionId: string): string {
  return `pdf-presenter-${sessionId}`;
}

export class PresentSync {
  private channel: BroadcastChannel;
  private stateListener: ((state: PresentState) => void) | null = null;
  private laserListener: ((position: LaserPosition) => void) | null = null;
  private inkListener:
    | ((slideIndex: number, strokes: InkStroke[]) => void)
    | null = null;
  private onRequest: (() => void) | null = null;

  constructor(sessionId: string) {
    this.channel = new BroadcastChannel(presentChannelName(sessionId));
    this.channel.onmessage = (ev: MessageEvent<PresentMessage>) => {
      const msg = ev.data;
      if (!msg?.type) return;
      switch (msg.type) {
        case "state":
          this.stateListener?.(msg.state);
          break;
        case "request-state":
          this.onRequest?.();
          break;
        case "laser":
          this.laserListener?.(msg.position);
          break;
        case "ephemeral-ink":
          this.inkListener?.(msg.slideIndex, msg.strokes);
          break;
        default:
          break;
      }
    };
  }

  onRequestState(handler: () => void): void {
    this.onRequest = handler;
  }

  publish(state: PresentState): void {
    this.channel.postMessage({ type: "state", state } satisfies PresentMessage);
  }

  publishLaser(position: LaserPosition): void {
    this.channel.postMessage({ type: "laser", position } satisfies PresentMessage);
  }

  publishEphemeralInk(slideIndex: number, strokes: InkStroke[]): void {
    this.channel.postMessage({
      type: "ephemeral-ink",
      slideIndex,
      strokes,
    } satisfies PresentMessage);
  }

  requestState(): void {
    this.channel.postMessage({ type: "request-state" } satisfies PresentMessage);
  }

  onState(handler: (state: PresentState) => void): void {
    this.stateListener = handler;
  }

  onLaser(handler: (position: LaserPosition) => void): void {
    this.laserListener = handler;
  }

  onEphemeralInk(
    handler: (slideIndex: number, strokes: InkStroke[]) => void,
  ): void {
    this.inkListener = handler;
  }

  close(): void {
    this.channel.close();
  }
}
