export interface Issue {
  number: number;
  title: string;
  body: string;
  labels: string[];
  url: string;
  state: 'open' | 'closed';
}
