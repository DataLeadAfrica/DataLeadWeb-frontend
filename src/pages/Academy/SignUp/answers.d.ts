// Types for answers.js, so TypeScript can see across into the one plain
// JavaScript file that holds the sign up rules. Same pattern as
// src/pages/Academy/Learn/Player/slices.d.ts.

export type Answers = {
  full_name?: string;
  email?: string;
  password?: string;
  country?: string;
  state?: string;
  region?: string;
  city?: string;
  postal_code?: string;
  age_band?: string;
  gender?: string;
  education_level?: string;
  qualification?: string;
  course_of_study?: string;
  trade?: string;
  occupation?: string;
  job_title?: string;
  business?: string;
  study_level?: string;
  school?: string;
  sector?: string;
  disability?: string;
  disability_detail?: string;
  heard_from?: string;
  goals?: string[];
  consent?: boolean;
};

export declare const COUNTRIES: string[];
export declare const NG_STATES: string[];
export declare const AGE_BANDS: [string, string][];
export declare const GENDERS: string[];
export declare const EDUCATION: [string, string][];
export declare const QUALIFICATIONS: [string, string][];
export declare const NYSC_QUALIFICATIONS: string[];
export declare const NYSC_BLOCKED_AGES: string[];
export declare const OCCUPATIONS: [string, string][];
export declare const STUDY_LEVELS: string[];
export declare const SECTORS: string[];
export declare const HEARD_FROM: string[];
export declare const GOALS: [string, string][];
export declare const DISABILITY: [string, string][];

export declare function sectorLabel(occupation: string | undefined): string;
export declare function nyscOffered(a: Answers): boolean;
export declare function shows(field: string, a: Answers): boolean;
export declare function firstProblem(a: Answers): { field: string; message: string } | null;
export declare function toMetadata(a: Answers): Record<string, unknown>;
export declare function clearHidden(a: Answers): Answers;
