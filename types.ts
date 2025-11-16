
export interface BaseLevel {
  description: string;
}

export interface PhonicsLevel extends BaseLevel {
  type: 'phonics';
  word: string;
  letters: string[];
}

export interface ShapeLevel extends BaseLevel {
  type: 'shape';
  shape: string;
}

export interface NumberLevel extends BaseLevel {
  type: 'number';
  num: number;
  stars: string;
}

export interface ColorLevel extends BaseLevel {
  type: 'color';
  emoji: string;
  name: string;
}

export interface SortLevel extends BaseLevel {
  type: 'sort';
  items: string[];
}

export type LevelConfig = PhonicsLevel | ShapeLevel | NumberLevel | ColorLevel | SortLevel;

export interface Progress {
  levels: boolean[];
  avatar: string;
  stars: number;
}

export type GameView = 'welcome' | 'levelsMenu' | 'game';
