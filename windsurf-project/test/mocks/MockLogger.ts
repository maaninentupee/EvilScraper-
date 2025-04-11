/**
 * MockLogger-luokka, joka simuloi NestJS:n Logger-luokkaa testejä varten
 */
export class MockLogger {
  public logs: { level: string; message: string; context?: string }[] = [];

  public log(message: string, context?: string): void {
    this.logs.push({ level: 'log', message, context });
    console.log(`[${context || 'Logger'}] ${message}`);
  }

  public error(message: string, trace?: string, context?: string): void {
    this.logs.push({ level: 'error', message, context });
    console.error("[" + (context || "Logger") + "] ERROR: " + message + (trace ? "\n" + trace : ""));
  }

  public warn(message: string, context?: string): void {
    this.logs.push({ level: 'warn', message, context });
    console.warn(`[${context || 'Logger'}] WARN: ${message}`);
  }

  public debug(message: string, context?: string): void {
    this.logs.push({ level: 'debug', message, context });
    console.debug(`[${context || 'Logger'}] DEBUG: ${message}`);
  }

  public verbose(message: string, context?: string): void {
    this.logs.push({ level: 'verbose', message, context });
    console.log(`[${context || 'Logger'}] VERBOSE: ${message}`);
  }

  /**
   * Palauttaa viimeisimmän lokin tietyllä tasolla
   */
  public getLastLogByLevel(level: string): string | undefined {
    const logs = this.logs.filter(log => log.level === level);
    if (logs.length > 0) {
      return logs[logs.length - 1].message;
    }
    return undefined;
  }

  /**
   * Palauttaa kaikki lokit tietyllä tasolla
   */
  public getAllLogsByLevel(level: string): string[] {
    return this.logs
      .filter(log => log.level === level)
      .map(log => log.message);
  }

  /**
   * Tyhjentää kaikki lokit
   */
  public clear(): void {
    this.logs = [];
  }
}
