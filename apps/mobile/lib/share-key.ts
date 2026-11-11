export interface SharedShareKey { key: string; keyId: string; deviceId: string; userId: string; apiBaseUrl: string; }
export interface ShareKeyDependencies {
  storage: { read(): Promise<SharedShareKey | null>; write(value: SharedShareKey): Promise<void>; remove(): Promise<void>; deviceId(): Promise<string> };
  api: { issue(deviceId: string, userId: string): Promise<{ id: string; key: string }>; revoke(id: string, userId: string): Promise<void> };
  apiBaseUrl: string;
}
/** Serializes the installation credential across auth and foreground transitions. */
export class ShareKeyManager {
  private tail: Promise<void> = Promise.resolve();
  private signingOut = false;
  private signedOutUser?: string;
  constructor(private readonly dependencies: ShareKeyDependencies) {}
  activate(userId: string) { if (this.signedOutUser === userId) this.signedOutUser = undefined; }
  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation);
    this.tail = result.then(() => {}, () => {});
    return result;
  }
  ensure(userId: string): Promise<void> {
    if (this.signingOut || this.signedOutUser === userId) return Promise.resolve();
    return this.serial(() => this.ensureInside(userId));
  }
  signOut(userId: string, finish: () => Promise<void>): Promise<void> {
    this.signingOut = true;
    return this.serial(async () => {
      try {
        await this.ensureInside(userId);
        const item = await this.dependencies.storage.read();
        if (!item || item.userId !== userId) throw new Error("Share key unavailable");
        await this.dependencies.api.revoke(item.keyId, userId);
        await finish();
        await this.dependencies.storage.remove();
        this.signedOutUser = userId;
      } finally { this.signingOut = false; }
    });
  }
  private async ensureInside(userId: string): Promise<void> {
    const current = await this.dependencies.storage.read();
    if (current?.userId === userId) return;
    const deviceId = await this.dependencies.storage.deviceId();
    const issued = await this.dependencies.api.issue(deviceId, userId);
    await this.dependencies.storage.write({ key: issued.key, keyId: issued.id, deviceId, userId, apiBaseUrl: this.dependencies.apiBaseUrl });
  }
}
