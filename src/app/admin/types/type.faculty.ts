export type Faculty =  {
  _id?: string;
  name: string;
  code: string;
  programLevel: 'bachelor' | 'master';
  type: 'semester' | 'yearly';
  totalSemestersOrYears: number;
  description: string;
};