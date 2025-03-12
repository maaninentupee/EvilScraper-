/**
 * MockModelSelector-luokka, joka simuloi ModelSelector-luokkaa testejä varten
 */
export class MockModelSelector {
  public getModelForType(type: string): string {
    // Palautetaan testimallin nimi
    return `mock-model-for-${type}`;
  }
}
