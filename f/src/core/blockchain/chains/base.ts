export interface ChainAdapter {
  claim(amount: number, proof: string[]): Promise<any>;
}